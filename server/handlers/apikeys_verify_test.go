package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"content-hub/server/models"
	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// setupAPIKeyTestDB 构造仅包含用户与 API Key 的内存数据库，便于快速验证授权逻辑。
func setupAPIKeyTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.AutoMigrate(&models.User{}, &models.APIKey{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

// seedAPIKey 用可预测的明文 Key 创建记录，返回明文以便测试请求时使用。
func seedAPIKey(t *testing.T, db *gorm.DB, scopes string, expiresAt *time.Time, revoked bool) (models.APIKey, string) {
	t.Helper()
	user := models.User{Username: "tester", Role: models.RoleUser, PasswordHash: "x"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	raw := "ch_test_key"
	key := models.APIKey{
		Name:        "demo",
		HashedKey:   models.HashAPIKey(raw),
		Scopes:      scopes,
		ExpiresAt:   expiresAt,
		Revoked:     revoked,
		BoundUserID: user.ID,
	}
	if err := db.Create(&key).Error; err != nil {
		t.Fatalf("create apikey: %v", err)
	}
	return key, raw
}

func TestVerifyAPIKeySuccess(t *testing.T) {
	db := setupAPIKeyTestDB(t)
	_, raw := seedAPIKey(t, db, string(models.ScopeFilesUpload), nil, false)

	body := bytes.NewBufferString(`{"scope":"files:upload"}`)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest(http.MethodPost, "/api/apikeys/verify", body)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", raw)
	c.Request = req

	VerifyAPIKey(db)(c)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", w.Code, w.Body.String())
	}
	var resp verifyAPIKeyResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if !resp.Valid {
		t.Fatalf("expected valid response")
	}
	if resp.BoundUser.Username != "tester" {
		t.Fatalf("unexpected bound user: %s", resp.BoundUser.Username)
	}
}

func TestVerifyAPIKeyMissingKey(t *testing.T) {
	db := setupAPIKeyTestDB(t)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest(http.MethodPost, "/api/apikeys/verify", nil)
	c.Request = req

	VerifyAPIKey(db)(c)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expect 400, got %d", w.Code)
	}
}

func TestVerifyAPIKeyScopeDenied(t *testing.T) {
	db := setupAPIKeyTestDB(t)
	_, raw := seedAPIKey(t, db, string(models.ScopeFilesUpload), nil, false)

	body := bytes.NewBufferString(`{"scope":"unapproved:scope"}`)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest(http.MethodPost, "/api/apikeys/verify", body)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", raw)
	c.Request = req

	VerifyAPIKey(db)(c)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expect 403, got %d", w.Code)
	}
}

func TestVerifyAPIKeyExpired(t *testing.T) {
	db := setupAPIKeyTestDB(t)
	expired := time.Now().Add(-time.Hour)
	_, raw := seedAPIKey(t, db, string(models.ScopeFilesUpload), &expired, false)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest(http.MethodPost, "/api/apikeys/verify", nil)
	req.Header.Set("X-API-Key", raw)
	c.Request = req

	VerifyAPIKey(db)(c)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expect 401, got %d", w.Code)
	}
}
