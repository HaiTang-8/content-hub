package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"content-hub/server/models"
	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// setupTestDB 创建仅驻留内存的 SQLite，避免污染本地数据文件。
func setupTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.AutoMigrate(&models.User{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

// createUser 是测试专用的用户创建工具，使用可预测密码以便断言。
func createUser(t *testing.T, db *gorm.DB, username, role string) models.User {
	t.Helper()
	user := models.User{Username: username, Role: role}
	if err := user.SetPassword("pass-" + username); err != nil {
		t.Fatalf("set password: %v", err)
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}
	return user
}

func TestListUsers(t *testing.T) {
	db := setupTestDB(t)
	admin := createUser(t, db, "admin", models.RoleAdmin)
	_ = createUser(t, db, "member", models.RoleUser)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/admin/users", nil)
	c.Set("userID", admin.ID)
	c.Set("role", models.RoleAdmin)

	ListUsers(db)(c)

	if w.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d body=%s", w.Code, w.Body.String())
	}

	var resp []UserResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(resp) != 2 {
		t.Fatalf("expect 2 users, got %d", len(resp))
	}

	var raw []map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &raw); err != nil {
		t.Fatalf("decode raw: %v", err)
	}
	if _, exists := raw[0]["password_hash"]; exists {
		t.Fatalf("password hash should not be exposed")
	}
}

func TestDeleteUserValidation(t *testing.T) {
	db := setupTestDB(t)
	admin := createUser(t, db, "admin", models.RoleAdmin)
	member := createUser(t, db, "member", models.RoleUser)

	// 不能删除自己
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{gin.Param{Key: "id", Value: fmt.Sprint(admin.ID)}}
	c.Set("userID", admin.ID)
	c.Set("role", models.RoleAdmin)
	c.Request = httptest.NewRequest(http.MethodDelete, "/admin/users/1", nil)

	DeleteUser(db)(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("self delete should fail, got %d", w.Code)
	}

	// 正常删除普通用户
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	c.Params = gin.Params{gin.Param{Key: "id", Value: fmt.Sprint(member.ID)}}
	c.Set("userID", admin.ID)
	c.Set("role", models.RoleAdmin)
	c.Request = httptest.NewRequest(http.MethodDelete, "/admin/users/2", nil)

	DeleteUser(db)(c)
	if w.Code != http.StatusOK {
		t.Fatalf("delete user should succeed, got %d body=%s", w.Code, w.Body.String())
	}
}

func TestResetPassword(t *testing.T) {
	db := setupTestDB(t)
	admin := createUser(t, db, "admin", models.RoleAdmin)
	member := createUser(t, db, "member", models.RoleUser)

	body := bytes.NewBufferString("{}")
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{gin.Param{Key: "id", Value: fmt.Sprint(member.ID)}}
	c.Request = httptest.NewRequest(http.MethodPost, "/admin/users/2/reset-password", body)
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("userID", admin.ID)
	c.Set("role", models.RoleAdmin)

	ResetPassword(db)(c)

	if w.Code != http.StatusOK {
		t.Fatalf("reset password failed: %d body=%s", w.Code, w.Body.String())
	}
	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	newPwd, _ := resp["password"].(string)
	if len(newPwd) == 0 {
		t.Fatal("new password should not be empty")
	}

	var refreshed models.User
	if err := db.First(&refreshed, member.ID).Error; err != nil {
		t.Fatalf("reload user: %v", err)
	}
	if !refreshed.CheckPassword(newPwd) {
		t.Fatalf("stored password hash does not match new password")
	}
}

func TestUpdateUserRole(t *testing.T) {
	db := setupTestDB(t)
	admin := createUser(t, db, "admin", models.RoleAdmin)
	member := createUser(t, db, "member", models.RoleUser)

	// 无法降级最后管理员（系统仅剩一名 admin）
	reqBody := bytes.NewBufferString(`{"role":"user"}`)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{gin.Param{Key: "id", Value: fmt.Sprint(admin.ID)}}
	c.Request = httptest.NewRequest(http.MethodPatch, "/admin/users/1/role", reqBody)
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("userID", admin.ID)
	c.Set("role", models.RoleAdmin)

	UpdateUserRole(db)(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("demote last admin should fail, got %d", w.Code)
	}
	var persistedAdmin models.User
	if err := db.First(&persistedAdmin, admin.ID).Error; err != nil {
		t.Fatalf("reload admin: %v", err)
	}
	if persistedAdmin.Role != models.RoleAdmin {
		t.Fatalf("admin role should remain after failed demotion")
	}

	// 重新补充管理员后，允许升级/降级其他账户
	newAdmin := createUser(t, db, "admin2", models.RoleAdmin)
	reqBody = bytes.NewBufferString(`{"role":"admin"}`)
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	c.Params = gin.Params{gin.Param{Key: "id", Value: fmt.Sprint(member.ID)}}
	c.Request = httptest.NewRequest(http.MethodPatch, "/admin/users/3/role", reqBody)
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("userID", newAdmin.ID)
	c.Set("role", models.RoleAdmin)

	UpdateUserRole(db)(c)
	if w.Code != http.StatusOK {
		t.Fatalf("promote user to admin failed: %d body=%s", w.Code, w.Body.String())
	}
	var promoted models.User
	if err := db.First(&promoted, member.ID).Error; err != nil {
		t.Fatalf("reload member: %v", err)
	}
	if promoted.Role != models.RoleAdmin {
		t.Fatalf("member role should be admin after promotion, got %s", promoted.Role)
	}
}
