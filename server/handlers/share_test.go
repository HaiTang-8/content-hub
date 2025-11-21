package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"content-hub/server/config"
	"content-hub/server/models"
	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// 确保已删除的底层文件不会导致流接口抛系统错误，而是向客户端返回友好的 404。
func TestStreamShareMissingFile(t *testing.T) {
	gin.SetMode(gin.TestMode)

	dbPath := filepath.Join(t.TempDir(), "test.db")
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.AutoMigrate(&models.User{}, &models.File{}, &models.Share{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	owner := models.User{Username: "owner", Role: models.RoleUser, PasswordHash: "x"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatalf("create owner: %v", err)
	}

	missingPath := filepath.Join(t.TempDir(), "missing.txt") // 路径存在但文件未创建
	file := models.File{
		OwnerID:  owner.ID,
		Filename: "missing.txt",
		Path:     missingPath,
		Size:     0,
		MimeType: "text/plain",
	}
	if err := db.Create(&file).Error; err != nil {
		t.Fatalf("create file: %v", err)
	}

	share := models.Share{
		Token:        "missing-share-token",
		FileID:       file.ID,
		CreatorID:    owner.ID,
		RequireLogin: false,
	}
	if err := db.Create(&share).Error; err != nil {
		t.Fatalf("create share: %v", err)
	}

	cfg := &config.Config{JWTSecret: "test-secret"}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest(http.MethodGet, "/api/shares/missing-share-token/stream", nil)
	c.Request = req
	c.Params = gin.Params{{Key: "token", Value: share.Token}}

	StreamShare(db, cfg)(c)

	if w.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d, body=%s", w.Code, w.Body.String())
	}

	var resp map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if !strings.Contains(resp["error"], "shared file") {
		t.Fatalf("unexpected error message: %q", resp["error"])
	}

	// 访问失败时不应计入 view_count
	var refreshed models.Share
	if err := db.First(&refreshed, share.ID).Error; err != nil {
		t.Fatalf("reload share: %v", err)
	}
	if refreshed.ViewCount != 0 {
		t.Fatalf("view_count incremented unexpectedly: %d", refreshed.ViewCount)
	}
}

// 验证批量清理：过期、文件缺失与次数耗尽的分享会被删除，正常的保留。
func TestCleanShares(t *testing.T) {
	gin.SetMode(gin.TestMode)
	dbPath := filepath.Join(t.TempDir(), "clean.db")
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.AutoMigrate(&models.User{}, &models.File{}, &models.Share{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	owner := models.User{Username: "owner", Role: models.RoleUser, PasswordHash: "x"}
	if err := db.Create(&owner).Error; err != nil {
		t.Fatalf("create owner: %v", err)
	}

	// 1) 过期分享
	expiredFile := models.File{OwnerID: owner.ID, Filename: "a.txt", Path: filepath.Join(t.TempDir(), "a.txt"), MimeType: "text/plain"}
	_ = db.Create(&expiredFile).Error
	expiredAt := time.Now().Add(-time.Hour)
	expiredShare := models.Share{Token: "expired", FileID: expiredFile.ID, CreatorID: owner.ID, RequireLogin: false, ExpiresAt: &expiredAt}
	_ = db.Create(&expiredShare).Error

	// 2) 文件缺失
	missingFile := models.File{OwnerID: owner.ID, Filename: "b.txt", Path: filepath.Join(t.TempDir(), "missing.txt"), MimeType: "text/plain"}
	_ = db.Create(&missingFile).Error
	missingShare := models.Share{Token: "missing", FileID: missingFile.ID, CreatorID: owner.ID, RequireLogin: false}
	_ = db.Create(&missingShare).Error

	// 3) 次数耗尽
	maxViews := uint(1)
	exhaustedFile := models.File{OwnerID: owner.ID, Filename: "c.txt", Path: filepath.Join(t.TempDir(), "c.txt"), MimeType: "text/plain"}
	_ = db.Create(&exhaustedFile).Error
	exhaustedShare := models.Share{Token: "exhausted", FileID: exhaustedFile.ID, CreatorID: owner.ID, RequireLogin: false, MaxViews: &maxViews, ViewCount: 1}
	_ = db.Create(&exhaustedShare).Error

	// 4) 正常的分享
	liveFilePath := filepath.Join(t.TempDir(), "alive.txt")
	_ = os.WriteFile(liveFilePath, []byte("ok"), 0o644)
	liveFile := models.File{OwnerID: owner.ID, Filename: "alive.txt", Path: liveFilePath, MimeType: "text/plain"}
	_ = db.Create(&liveFile).Error
	liveShare := models.Share{Token: "alive", FileID: liveFile.ID, CreatorID: owner.ID, RequireLogin: false}
	_ = db.Create(&liveShare).Error

	body := strings.NewReader(`{"remove_expired":true,"remove_missing_file":true,"remove_exhausted":true}`)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest(http.MethodPost, "/api/admin/shares/cleanup", body)
	req.Header.Set("Content-Type", "application/json")
	c.Request = req

	CleanShares(db)(c)

	if w.Code != http.StatusOK {
		t.Fatalf("cleanup status = %d, body=%s", w.Code, w.Body.String())
	}

	var resp struct {
		Deleted int `json:"deleted"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if resp.Deleted != 3 {
		t.Fatalf("expected delete 3 shares, got %d", resp.Deleted)
	}

	var count int64
	if err := db.Model(&models.Share{}).Where("token = ?", liveShare.Token).Count(&count).Error; err != nil {
		t.Fatalf("count live: %v", err)
	}
	if count != 1 {
		t.Fatalf("live share removed unexpectedly")
	}
}
