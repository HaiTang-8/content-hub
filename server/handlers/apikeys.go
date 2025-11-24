package handlers

import (
	"net/http"
	"strings"
	"time"

	"content-hub/server/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type createAPIKeyRequest struct {
	Name          string   `json:"name" binding:"required"`
	Scopes        []string `json:"scopes"`
	BoundUserID   uint     `json:"bound_user_id" binding:"required"`
	ExpiresInDays *int     `json:"expires_in_days"`
}

type apiKeyUser struct {
	ID       uint   `json:"id"`
	Username string `json:"username"`
}

type apiKeyResponse struct {
	ID         uint       `json:"id"`
	Name       string     `json:"name"`
	Scopes     []string   `json:"scopes"`
	KeyPreview string     `json:"key_preview"`
	Revoked    bool       `json:"revoked"`
	ExpiresAt  *time.Time `json:"expires_at"`
	CreatedAt  time.Time  `json:"created_at"`
	LastUsedAt *time.Time `json:"last_used_at"`
	BoundUser  apiKeyUser `json:"bound_user"`
	CreatedBy  apiKeyUser `json:"created_by"`
}

type createAPIKeyResponse struct {
	apiKeyResponse
	PlainKey string `json:"plain_key"`
}

// verifyAPIKeyRequest 支持从 Header 或 JSON 中读取明文 Key，可选 scope 用于校验授权。
type verifyAPIKeyRequest struct {
	APIKey string `json:"api_key"`
	Scope  string `json:"scope"`
}

// verifyAPIKeyResponse 返回验证结果及与权限相关的基础元数据，供前端在提交前做即时提示。
type verifyAPIKeyResponse struct {
	Valid     bool       `json:"valid"`
	Scopes    []string   `json:"scopes"`
	ExpiresAt *time.Time `json:"expires_at"`
	BoundUser apiKeyUser `json:"bound_user"`
	Message   string     `json:"message"`
}

var allowedScopes = map[models.APIScope]bool{
	models.ScopeFilesUpload: true,
}

// CreateAPIKey 供管理员生成新的 Key，默认赋予上传权限并绑定资源归属用户。
// @Summary 创建 API Key
// @Tags admin
// @Accept json
// @Produce json
// @Param payload body createAPIKeyRequest true "密钥配置"
// @Security BearerAuth
// @Router /admin/apikeys [post]
func CreateAPIKey(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req createAPIKeyRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if len(req.Scopes) == 0 {
			req.Scopes = []string{string(models.ScopeFilesUpload)}
		}

		if !validateScopes(req.Scopes) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "包含未支持的 scope"})
			return
		}

		var boundUser models.User
		if err := db.First(&boundUser, req.BoundUserID).Error; err != nil {
			status := http.StatusBadRequest
			if err == gorm.ErrRecordNotFound {
				status = http.StatusNotFound
			}
			c.JSON(status, gin.H{"error": "绑定的用户不存在"})
			return
		}

		expiresAt := computeExpires(req.ExpiresInDays)
		if req.ExpiresInDays != nil && expiresAt == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "expires_in_days 需大于 0"})
			return
		}

		plainKey, err := models.GenerateRawAPIKey()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "生成 API Key 失败"})
			return
		}

		hashed := models.HashAPIKey(plainKey)
		scopeStr := strings.Join(req.Scopes, ",")
		creatorIDVal, ok := c.Get("userID")
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "缺少创建者信息，请重新登录后重试"})
			return
		}
		creatorID, _ := creatorIDVal.(uint)

		key := models.APIKey{
			Name:        req.Name,
			HashedKey:   hashed,
			Scopes:      scopeStr,
			ExpiresAt:   expiresAt,
			BoundUserID: boundUser.ID,
			CreatedByID: creatorID,
		}

		if err := db.Create(&key).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		resp := createAPIKeyResponse{
			apiKeyResponse: buildAPIKeyResponse(&key, &boundUser, nil),
			PlainKey:       plainKey,
		}
		c.JSON(http.StatusOK, resp)
	}
}

// ListAPIKeys 返回所有密钥的元数据，脱敏展示 key 片段。
// @Summary API Key 列表
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Router /admin/apikeys [get]
func ListAPIKeys(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var keys []models.APIKey
		if err := db.Preload("BoundUser").Preload("CreatedBy").Order("created_at DESC").Find(&keys).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		resp := make([]apiKeyResponse, 0, len(keys))
		for _, k := range keys {
			resp = append(resp, buildAPIKeyResponse(&k, &k.BoundUser, &k.CreatedBy))
		}
		c.JSON(http.StatusOK, resp)
	}
}

// RevokeAPIKey 通过软删除方式撤销 Key，保留记录以便审计。
// @Summary 撤销 API Key
// @Tags admin
// @Produce json
// @Param id path int true "Key ID"
// @Security BearerAuth
// @Router /admin/apikeys/{id} [delete]
func RevokeAPIKey(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		var key models.APIKey
		if err := db.First(&key, id).Error; err != nil {
			status := http.StatusBadRequest
			if err == gorm.ErrRecordNotFound {
				status = http.StatusNotFound
			}
			c.JSON(status, gin.H{"error": "API Key 不存在"})
			return
		}

		if key.Revoked {
			c.JSON(http.StatusOK, gin.H{"message": "已撤销"})
			return
		}

		if err := db.Model(&key).Update("revoked", true).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "API Key 已撤销"})
	}
}

// VerifyAPIKey 校验明文 API Key 是否有效，以及是否具备指定 scope（默认 files:upload）。
// 设计为公有接口，方便客户端在保存密钥后先行检测权限，减少正式调用时的失败概率。
// @Summary 校验 API Key 有效性
// @Tags apikey
// @Accept json
// @Produce json
// @Param X-API-Key header string false "明文 API Key"
// @Param payload body verifyAPIKeyRequest false "可选：api_key 与 scope，若未提供则默认 files:upload"
// @Router /apikeys/verify [post]
func VerifyAPIKey(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req verifyAPIKeyRequest
		// 忽略解析错误，允许纯 Header 调用；解析成功时优先使用 body 内的值。
		_ = c.ShouldBindJSON(&req)

		rawKey := strings.TrimSpace(c.GetHeader("X-API-Key"))
		if req.APIKey != "" { // JSON 中携带 api_key 时覆盖 Header，便于表单调试
			rawKey = strings.TrimSpace(req.APIKey)
		}
		if rawKey == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "缺少 X-API-Key 请求头或 api_key 字段"})
			return
		}

		hashed := models.HashAPIKey(rawKey)
		var key models.APIKey
		if err := db.Preload("BoundUser").Where("hashed_key = ?", hashed).First(&key).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "API Key 无效或不存在"})
			return
		}
		if key.Revoked {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "API Key 已被撤销"})
			return
		}
		if key.ExpiresAt != nil && time.Now().After(*key.ExpiresAt) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "API Key 已过期"})
			return
		}

		requiredScope := strings.TrimSpace(req.Scope)
		if requiredScope == "" {
			requiredScope = string(models.ScopeFilesUpload)
		}
		if !key.HasScope(models.APIScope(requiredScope)) {
			c.JSON(http.StatusForbidden, gin.H{"error": "API Key 未授权访问该 scope"})
			return
		}

		// 记录验证行为的最后使用时间，方便后台了解密钥活跃度，但不阻断正常响应。
		now := time.Now()
		_ = db.Model(&key).UpdateColumn("last_used_at", now).Error

		resp := verifyAPIKeyResponse{
			Valid:     true,
			Scopes:    key.ScopeList(),
			ExpiresAt: key.ExpiresAt,
			BoundUser: apiKeyUser{ID: key.BoundUserID, Username: key.BoundUser.Username},
			Message:   "API Key 可用",
		}
		c.JSON(http.StatusOK, resp)
	}
}

func buildAPIKeyResponse(key *models.APIKey, boundUser *models.User, creator *models.User) apiKeyResponse {
	resp := apiKeyResponse{
		ID:         key.ID,
		Name:       key.Name,
		Scopes:     key.ScopeList(),
		KeyPreview: models.MaskedKey(key.HashedKey),
		Revoked:    key.Revoked,
		ExpiresAt:  key.ExpiresAt,
		CreatedAt:  key.CreatedAt,
		LastUsedAt: key.LastUsedAt,
		BoundUser: apiKeyUser{
			ID:       boundUser.ID,
			Username: boundUser.Username,
		},
	}
	if creator != nil {
		resp.CreatedBy = apiKeyUser{ID: creator.ID, Username: creator.Username}
	}
	return resp
}

// validateScopes 确保请求中的 scope 列表均在允许范围内。
func validateScopes(scopes []string) bool {
	if len(scopes) == 0 {
		return false
	}
	for _, s := range scopes {
		if !allowedScopes[models.APIScope(strings.TrimSpace(s))] {
			return false
		}
	}
	return true
}

// computeExpires 依据天数生成过期时间，nil 表示永久有效。
func computeExpires(days *int) *time.Time {
	if days == nil {
		return nil
	}
	if *days <= 0 {
		return nil
	}
	deadline := time.Now().Add(time.Duration(*days) * 24 * time.Hour)
	return &deadline
}
