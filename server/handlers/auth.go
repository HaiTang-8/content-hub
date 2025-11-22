package handlers

import (
	"net/http"

	"content-hub/server/config"
	"content-hub/server/middleware"
	"content-hub/server/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// Login 用户登录，返回 JWT 与用户信息。
// @Summary 用户登录
// @Tags auth
// @Accept json
// @Produce json
// @Param payload body LoginRequest true "登录参数"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Router /login [post]
func Login(db *gorm.DB, cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req LoginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		var user models.User
		if err := db.Where("username = ?", req.Username).First(&user).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
			return
		}
		if !user.CheckPassword(req.Password) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
			return
		}
		token, err := middleware.GenerateToken(user.ID, user.Role, cfg)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "token error"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"token": token,
			"user":  gin.H{"id": user.ID, "username": user.Username, "role": user.Role},
		})
	}
}
