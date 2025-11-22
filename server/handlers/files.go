package handlers

import (
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"content-hub/server/config"
	"content-hub/server/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type FileResponse struct {
	ID          uint      `json:"id"`
	Filename    string    `json:"filename"`
	Size        int64     `json:"size"`
	MimeType    string    `json:"mime_type"`
	Description string    `json:"description"`
	Owner       string    `json:"owner"`
	PublicLink  string    `json:"public_link"`
	CreatedAt   time.Time `json:"created_at"`
}

// ListFiles 列出当前用户可见的文件列表。
// @Summary 获取文件列表
// @Tags files
// @Produce json
// @Security BearerAuth
// @Router /files [get]
func ListFiles(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		var files []models.File
		if err := db.Preload("Owner").Order("created_at desc").Find(&files).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		resp := make([]FileResponse, 0, len(files))
		for _, f := range files {
			resp = append(resp, FileResponse{
				ID:          f.ID,
				Filename:    f.Filename,
				Size:        f.Size,
				MimeType:    f.MimeType,
				Description: f.Description,
				Owner:       f.Owner.Username,
				PublicLink:  f.PublicLink,
				CreatedAt:   f.CreatedAt,
			})
		}
		c.JSON(http.StatusOK, resp)
	}
}

// UploadFile 支持文件或纯文本上传，允许 JWT 或 API Key 鉴权。
// @Summary 上传文件或文字
// @Tags files
// @Accept mpfd
// @Produce json
// @Param file formData file false "上传文件"
// @Param text formData string false "纯文本内容"
// @Param description formData string false "描述"
// @Security BearerAuth
// @Security ApiKeyAuth
// @Router /files [post]
func UploadFile(db *gorm.DB, cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDVal, exists := c.Get("userID")
		userID, ok := userIDVal.(uint)
		if !exists || !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "无法识别上传者，请重新登录或检查 API Key"})
			return
		}

		description := c.PostForm("description")
		textContent := c.PostForm("text")
		fileHeader, err := c.FormFile("file")
		if err != nil && textContent == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "file or text is required"})
			return
		}

		if err := os.MkdirAll(cfg.UploadDir, 0o755); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		var savedPath, filename, mime string
		var size int64

		if fileHeader != nil {
			filename = fileHeader.Filename
			mime = fileHeader.Header.Get("Content-Type")
			savedPath = filepath.Join(cfg.UploadDir, fmt.Sprintf("%d-%s", time.Now().UnixNano(), filename))
			if err := c.SaveUploadedFile(fileHeader, savedPath); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			size = fileHeader.Size
		} else {
			filename = fmt.Sprintf("text-%d.txt", time.Now().UnixNano())
			mime = "text/plain"
			savedPath = filepath.Join(cfg.UploadDir, filename)
			if err := os.WriteFile(savedPath, []byte(textContent), 0o644); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			size = int64(len(textContent))
		}

		f := models.File{
			OwnerID:     userID,
			Filename:    filename,
			Path:        savedPath,
			Size:        size,
			MimeType:    mime,
			Description: description,
		}
		if err := db.Create(&f).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"id": f.ID, "filename": f.Filename})
	}
}

func DownloadFile(db *gorm.DB) gin.HandlerFunc {
	// DownloadFile 通过附件形式下载指定文件。
	// @Summary 下载文件
	// @Tags files
	// @Produce octet-stream
	// @Param id path int true "文件ID"
	// @Security BearerAuth
	// @Router /files/{id}/download [get]
	return func(c *gin.Context) {
		var f models.File
		if err := db.First(&f, c.Param("id")).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.FileAttachment(f.Path, f.Filename)
	}
}

// GetFileInfo returns metadata.
func GetFileInfo(db *gorm.DB) gin.HandlerFunc {
	// GetFileInfo 获取文件元数据。
	// @Summary 获取文件信息
	// @Tags files
	// @Produce json
	// @Param id path int true "文件ID"
	// @Security BearerAuth
	// @Router /files/{id} [get]
	return func(c *gin.Context) {
		var f models.File
		if err := db.Preload("Owner").First(&f, c.Param("id")).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusOK, FileResponse{
			ID:          f.ID,
			Filename:    f.Filename,
			Size:        f.Size,
			MimeType:    f.MimeType,
			Description: f.Description,
			Owner:       f.Owner.Username,
			PublicLink:  f.PublicLink,
			CreatedAt:   f.CreatedAt,
		})
	}
}

// StreamFile returns raw content preview (text/image) with MIME.
func StreamFile(db *gorm.DB) gin.HandlerFunc {
	// StreamFile 以内联方式预览文件内容。
	// @Summary 预览文件
	// @Tags files
	// @Produce octet-stream
	// @Param id path int true "文件ID"
	// @Security BearerAuth
	// @Router /files/{id}/stream [get]
	return func(c *gin.Context) {
		var f models.File
		if err := db.First(&f, c.Param("id")).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		file, err := os.Open(f.Path)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer file.Close()
		c.Header("Content-Type", f.MimeType)
		c.Status(http.StatusOK)
		_, _ = io.Copy(c.Writer, file)
	}
}

// DeleteFile performs role-aware deletion. Users soft-delete their own uploads,
// admins can permanently delete any record (including already soft-deleted ones).
func DeleteFile(db *gorm.DB) gin.HandlerFunc {
	// DeleteFile 删除文件，管理员为物理删除，普通用户为软删除。
	// @Summary 删除文件
	// @Tags files
	// @Produce json
	// @Param id path int true "文件ID"
	// @Security BearerAuth
	// @Router /files/{id} [delete]
	return func(c *gin.Context) {
		roleVal, _ := c.Get("role")
		role, _ := roleVal.(string)
		userIDVal, _ := c.Get("userID")
		userID, _ := userIDVal.(uint)
		fileID := c.Param("id")

		var f models.File
		query := db.Where("id = ?", fileID)
		if role == models.RoleAdmin {
			query = db.Unscoped().Where("id = ?", fileID)
		} else {
			query = query.Where("owner_id = ?", userID)
		}

		if err := query.First(&f).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if role == models.RoleAdmin {
			if err := os.Remove(f.Path); err != nil && !errors.Is(err, os.ErrNotExist) {
				log.Printf("remove file %s: %v", f.Path, err)
			}
			if err := db.Unscoped().Delete(&f).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"status": "deleted", "mode": "permanent"})
			return
		}

		if err := db.Delete(&f).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "deleted", "mode": "soft"})
	}
}
