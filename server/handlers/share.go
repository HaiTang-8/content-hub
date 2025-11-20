package handlers

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"content-hub/server/config"
	"content-hub/server/middleware"
	"content-hub/server/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

const maxShareViews uint = 1000

var shareDurations = map[int]time.Duration{
	1:  24 * time.Hour,
	7:  7 * 24 * time.Hour,
	30: 30 * 24 * time.Hour,
}

type shareRequest struct {
	RequireLogin  *bool  `json:"require_login"`
	AllowUsername string `json:"allow_username"`
	MaxViews      *uint  `json:"max_views"`
	ExpiresInDays *int   `json:"expires_in_days"`
}

// CreateShare 生成带安全策略的预览链接，默认要求登录且 7 天内有效。
func CreateShare(db *gorm.DB, cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		var f models.File
		if err := db.Preload("Owner").First(&f, c.Param("id")).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}

		userIDVal, _ := c.Get("userID")
		roleVal, _ := c.Get("role")
		userID, _ := userIDVal.(uint)
		role, _ := roleVal.(string)
		if role != models.RoleAdmin && f.OwnerID != userID {
			c.JSON(http.StatusForbidden, gin.H{"error": "no permission to share this file"})
			return
		}

		var req shareRequest
		if err := c.ShouldBindJSON(&req); err != nil && !errors.Is(err, io.EOF) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
			return
		}

		requireLogin := true
		if req.RequireLogin != nil {
			requireLogin = *req.RequireLogin
		}

		var allowUserID *uint
		allowUser := strings.TrimSpace(req.AllowUsername)
		if allowUser != "" {
			if role != models.RoleAdmin {
				c.JSON(http.StatusForbidden, gin.H{"error": "only admin can limit receiver"})
				return
			}
			var u models.User
			if err := db.Where("username = ?", allowUser).First(&u).Error; err != nil {
				status := http.StatusBadRequest
				if errors.Is(err, gorm.ErrRecordNotFound) {
					status = http.StatusNotFound
				}
				c.JSON(status, gin.H{"error": "指定的接收用户不存在"})
				return
			}
			allowUserID = &u.ID
			// 限定到具体用户时必须登录，否则无法识别身份
			requireLogin = true
		}

		var maxViews *uint
		if req.MaxViews != nil {
			if *req.MaxViews == 0 || *req.MaxViews > maxShareViews {
				c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("max_views 需为 1-%d", maxShareViews)})
				return
			}
			max := *req.MaxViews
			maxViews = &max
		}

		expiresAt := computeExpiresAt(req.ExpiresInDays)
		if expiresAt == nil && req.ExpiresInDays != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "expires_in_days 仅支持 1 / 7 / 30"})
			return
		}

		share := models.Share{
			Token:        uuid.NewString(),
			FileID:       f.ID,
			CreatorID:    userID,
			RequireLogin: requireLogin,
			AllowUserID:  allowUserID,
			MaxViews:     maxViews,
			ExpiresAt:    expiresAt,
		}

		if err := db.Create(&share).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"share_token":    share.Token,
			"preview_path":   fmt.Sprintf("/preview/%s", share.Token),
			"requires_login": share.RequireLogin,
			"allow_username": allowUser,
			"max_views":      maxViews,
			"expires_at":     expiresAt,
		})
	}
}

// GetShareMeta 返回预览所需的文件元信息，同时做访问权限判断但不增加计数。
func GetShareMeta(db *gorm.DB, cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		share, err := loadShare(db, c.Param("token"))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "share not found"})
			return
		}

		claims, err := parseOptionalClaims(c, cfg)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}

		if !checkShareAccess(c, share, claims, true) {
			return
		}

		remaining := remainingViews(share)
		c.JSON(http.StatusOK, gin.H{
			"token":             share.Token,
			"filename":          share.File.Filename,
			"mime_type":         share.File.MimeType,
			"size":              share.File.Size,
			"description":       share.File.Description,
			"owner":             share.File.Owner.Username,
			"requires_login":    share.RequireLogin,
			"allow_username":    optionalUsername(share.AllowUser),
			"max_views":         share.MaxViews,
			"remaining_views":   remaining,
			"expires_at":        share.ExpiresAt,
			"created_at":        share.CreatedAt,
			"stream_path":       fmt.Sprintf("/api/shares/%s/stream", share.Token),
			"preview_available": true,
		})
	}
}

// StreamShare 执行安全校验后以内联方式返回文件内容，不强制下载。
func StreamShare(db *gorm.DB, cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		share, err := loadShare(db, c.Param("token"))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "share not found"})
			return
		}

		claims, err := parseOptionalClaims(c, cfg)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}

		if !checkShareAccess(c, share, claims, true) {
			return
		}

		// 控制访问次数：带上上限的情况下需要在返回前占用 1 次额度，避免并发下超过限制
		if err := consumeView(db, share); err != nil {
			status := http.StatusInternalServerError
			if errors.Is(err, errShareLimitReached) {
				status = http.StatusGone
			}
			c.JSON(status, gin.H{"error": err.Error()})
			return
		}

		file, err := os.Open(share.File.Path)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer file.Close()

		c.Header("Content-Type", share.File.MimeType)
		c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", url.PathEscape(share.File.Filename)))
		c.Status(http.StatusOK)
		_, _ = io.Copy(c.Writer, file)
	}
}

// LegacyShareRedirect 保持旧地址不再触发下载，提示使用新的预览链接。
func LegacyShareRedirect() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.JSON(http.StatusGone, gin.H{"error": "分享链接已升级，请使用新的预览地址"})
	}
}

type shareListItem struct {
	Token          string     `json:"token"`
	Filename       string     `json:"filename"`
	FileOwner      string     `json:"file_owner"`
	Creator        string     `json:"creator"`
	RequireLogin   bool       `json:"require_login"`
	AllowUsername  string     `json:"allow_username"`
	MaxViews       *uint      `json:"max_views"`
	ViewCount      uint       `json:"view_count"`
	RemainingViews *uint      `json:"remaining_views"`
	ExpiresAt      *time.Time `json:"expires_at"`
	CreatedAt      time.Time  `json:"created_at"`
}

// ListShares 仅管理员可见，用于后台查看与治理分享链接。
func ListShares(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var shares []models.Share
		if err := db.
			Preload("File").
			Preload("File.Owner").
			Preload("Creator").
			Preload("AllowUser").
			Order("created_at desc").
			Find(&shares).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		resp := make([]shareListItem, 0, len(shares))
		for _, s := range shares {
			resp = append(resp, shareListItem{
				Token:          s.Token,
				Filename:       s.File.Filename,
				FileOwner:      s.File.Owner.Username,
				Creator:        s.Creator.Username,
				RequireLogin:   s.RequireLogin,
				AllowUsername:  optionalUsername(s.AllowUser),
				MaxViews:       s.MaxViews,
				ViewCount:      s.ViewCount,
				RemainingViews: remainingViews(&s),
				ExpiresAt:      s.ExpiresAt,
				CreatedAt:      s.CreatedAt,
			})
		}
		c.JSON(http.StatusOK, resp)
	}
}

// RevokeShare 允许管理员撤销分享，立即失效。
func RevokeShare(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.Param("token")
		if token == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing share token"})
			return
		}
		if err := db.Where("token = ?", token).Delete(&models.Share{}).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "share revoked"})
	}
}

func computeExpiresAt(days *int) *time.Time {
	// 默认为 7 天；若传入 nil 则使用默认值，传入不受支持的值返回 nil
	if days == nil {
		def := 7
		return computeExpiresAt(&def)
	}
	dur, ok := shareDurations[*days]
	if !ok {
		return nil
	}
	deadline := time.Now().Add(dur)
	return &deadline
}

func loadShare(db *gorm.DB, token string) (*models.Share, error) {
	var share models.Share
	if err := db.Preload("File").Preload("File.Owner").Preload("AllowUser").Where("token = ?", token).First(&share).Error; err != nil {
		return nil, err
	}
	return &share, nil
}

func optionalUsername(u *models.User) string {
	if u == nil {
		return ""
	}
	return u.Username
}

func remainingViews(share *models.Share) *uint {
	if share.MaxViews == nil {
		return nil
	}
	if share.ViewCount >= *share.MaxViews {
		zero := uint(0)
		return &zero
	}
	remain := *share.MaxViews - share.ViewCount
	return &remain
}

func checkShareAccess(c *gin.Context, share *models.Share, claims *middleware.Claims, requireLimitCheck bool) bool {
	now := time.Now()
	if share.Expired(now) {
		c.JSON(http.StatusGone, gin.H{"error": "分享已过期"})
		return false
	}
	if share.MaxViews != nil && share.ViewCount >= *share.MaxViews && requireLimitCheck {
		c.JSON(http.StatusGone, gin.H{"error": "查看次数已用尽"})
		return false
	}
	if share.RequireLogin && claims == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "该分享需要登录"})
		return false
	}
	if share.AllowUserID != nil {
		if claims == nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "该分享仅限指定用户访问"})
			return false
		}
		if claims.UserID != *share.AllowUserID {
			c.JSON(http.StatusForbidden, gin.H{"error": "无权访问该分享"})
			return false
		}
	}
	return true
}

func parseOptionalClaims(c *gin.Context, cfg *config.Config) (*middleware.Claims, error) {
	header := c.GetHeader("Authorization")
	if header == "" {
		return nil, nil
	}
	parts := strings.SplitN(header, " ", 2)
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return nil, errors.New("invalid Authorization header")
	}
	tokenStr := parts[1]
	token, err := jwt.ParseWithClaims(tokenStr, &middleware.Claims{}, func(t *jwt.Token) (interface{}, error) {
		return []byte(cfg.JWTSecret), nil
	})
	if err != nil || !token.Valid {
		return nil, errors.New("invalid token")
	}
	claims, ok := token.Claims.(*middleware.Claims)
	if !ok {
		return nil, errors.New("invalid claims")
	}
	return claims, nil
}

var errShareLimitReached = errors.New("查看次数已用尽")

func consumeView(db *gorm.DB, share *models.Share) error {
	if share.MaxViews != nil {
		res := db.Model(&models.Share{}).Where("id = ? AND view_count < ?", share.ID, *share.MaxViews).UpdateColumn("view_count", gorm.Expr("view_count + 1"))
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return errShareLimitReached
		}
		share.ViewCount++
		return nil
	}

	if err := db.Model(&models.Share{}).Where("id = ?", share.ID).UpdateColumn("view_count", gorm.Expr("view_count + 1")).Error; err != nil {
		return err
	}
	share.ViewCount++
	return nil
}
