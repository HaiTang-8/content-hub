package middleware

import (
	"net/http"
	"strings"
	"time"

	"content-hub/server/config"
	"content-hub/server/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// APIKeyOrAuth 允许请求使用 JWT 或 API Key 两种方式通过校验，便于按 scope 开放特定接口。
//   - 若携带 Authorization 且合法，使用登录身份透传 userID/role
//   - 若未携带 JWT，则读取 X-API-Key，校验哈希、有效期与 scope，再将绑定用户注入上下文
//     以便后续处理逻辑与登录用户复用同一套 owner/权限判断
func APIKeyOrAuth(db *gorm.DB, cfg *config.Config, requiredScope models.APIScope) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if strings.TrimSpace(header) != "" {
			claims, err := ParseJWTClaims(header, cfg)
			if err != nil {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
				return
			}
			c.Set("authMode", "jwt")
			c.Set("userID", claims.UserID)
			c.Set("role", claims.Role)
			c.Next()
			return
		}

		rawKey := strings.TrimSpace(c.GetHeader("X-API-Key"))
		if rawKey == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "缺少 Authorization 或 X-API-Key"})
			return
		}

		hashed := models.HashAPIKey(rawKey)
		var key models.APIKey
		if err := db.Preload("BoundUser").Where("hashed_key = ? AND revoked = ?", hashed, false).First(&key).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "无效的 API Key"})
			return
		}

		if key.ExpiresAt != nil && time.Now().After(*key.ExpiresAt) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "API Key 已过期"})
			return
		}

		if !key.HasScope(requiredScope) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "API Key 未授权访问该接口"})
			return
		}

		if key.BoundUserID == 0 || key.BoundUser.ID == 0 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "API Key 未绑定有效用户，无法归属上传者"})
			return
		}

		// 记录最近使用时间，但不阻断请求流程；失败时仅打印日志由 Gorm 处理
		now := time.Now()
		_ = db.Model(&key).UpdateColumn("last_used_at", now).Error

		c.Set("authMode", "api_key")
		c.Set("apiKeyID", key.ID)
		c.Set("userID", key.BoundUserID)
		c.Set("role", key.BoundUser.Role)
		c.Next()
	}
}
