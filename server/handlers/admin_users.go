package handlers

import (
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"time"

	"content-hub/server/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type CreateUserRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
	Role     string `json:"role" binding:"required,oneof=admin user"`
}

// UserResponse 用于向前端返回用户的脱敏信息，避免暴露密码哈希。
type UserResponse struct {
	ID        uint      `json:"id"`
	Username  string    `json:"username"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

type UpdateUserRoleRequest struct {
	Role string `json:"role" binding:"required,oneof=admin user"`
}

type ResetPasswordRequest struct {
	Password string `json:"password"`
}

func CreateUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req CreateUserRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		u := models.User{Username: req.Username, Role: req.Role}
		if err := u.SetPassword(req.Password); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "hash error"})
			return
		}
		if err := db.Create(&u).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"id": u.ID, "username": u.Username, "role": u.Role})
	}
}

// ListUsers 以创建时间倒序返回所有用户，供管理员界面展示列表。
func ListUsers(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var users []models.User
		if err := db.Order("created_at DESC").Find(&users).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "无法获取用户列表"})
			return
		}
		resp := make([]UserResponse, 0, len(users))
		for _, u := range users {
			resp = append(resp, UserResponse{ID: u.ID, Username: u.Username, Role: u.Role, CreatedAt: u.CreatedAt})
		}
		c.JSON(http.StatusOK, resp)
	}
}

// DeleteUser 允许管理员删除其他账号，并保护最后一名管理员与当前登录用户。
func DeleteUser(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var target models.User
		if err := db.First(&target, c.Param("id")).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "用户不存在"})
			return
		}

		if isCurrentUser(c, target.ID) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "不能删除正在登录的账号"})
			return
		}

		if err := ensureAdminWillRemain(db, target.Role); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if err := db.Delete(&target).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "删除用户失败"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"id": target.ID})
	}
}

// UpdateUserRole 支持在普通用户与管理员间切换，确保至少保留一名管理员。
func UpdateUserRole(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req UpdateUserRoleRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		var target models.User
		if err := db.First(&target, c.Param("id")).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "用户不存在"})
			return
		}

		if target.Role == models.RoleAdmin && req.Role != models.RoleAdmin {
			if err := ensureAdminWillRemain(db, target.Role); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}
		}

		target.Role = req.Role
		if err := db.Save(&target).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "更新角色失败"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"id": target.ID, "role": target.Role})
	}
}

// ResetPassword 允许管理员重置指定用户密码，后端返回明文新密码便于传达给用户。
func ResetPassword(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req ResetPasswordRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		var target models.User
		if err := db.First(&target, c.Param("id")).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "用户不存在"})
			return
		}

		newPassword := req.Password
		if newPassword == "" {
			var err error
			newPassword, err = generatePassword(12)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "生成新密码失败"})
				return
			}
		}

		if err := target.SetPassword(newPassword); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "重置密码失败"})
			return
		}
		if err := db.Save(&target).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "保存新密码失败"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"id": target.ID, "username": target.Username, "password": newPassword})
	}
}

// ensureAdminWillRemain 确保变更后仍有至少一名管理员存在，避免被误删或降级。
func ensureAdminWillRemain(db *gorm.DB, targetRole string) error {
	if targetRole != models.RoleAdmin {
		return nil
	}
	var adminCount int64
	if err := db.Model(&models.User{}).Where("role = ?", models.RoleAdmin).Count(&adminCount).Error; err != nil {
		return errors.New("检查管理员数量失败")
	}
	if adminCount <= 1 {
		return errors.New("至少保留一名管理员")
	}
	return nil
}

// isCurrentUser 判断当前请求上下文中的用户是否为目标用户，用于禁止自删。
func isCurrentUser(c *gin.Context, targetID uint) bool {
	userIDVal, exists := c.Get("userID")
	if !exists {
		return false
	}
	userID, ok := userIDVal.(uint)
	if !ok {
		return false
	}
	return userID == targetID
}

// generatePassword 通过安全随机数生成指定长度的密码，包含大小写与数字字符。
func generatePassword(length int) (string, error) {
	const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
	result := make([]byte, length)
	for i := 0; i < length; i++ {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
		if err != nil {
			return "", fmt.Errorf("rand error: %w", err)
		}
		result[i] = charset[n.Int64()]
	}
	return string(result), nil
}
