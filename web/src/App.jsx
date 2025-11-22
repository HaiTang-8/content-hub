import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Login from './views/Login'
import Content from './views/Content'
import UserManagement from './views/UserManagement'
import ShareManage from './views/ShareManage'
import ApiKeyManage from './views/ApiKeyManage'
import Shell from './views/Shell'
import { useAuthStore } from './store/auth'
import SharePreview from './views/SharePreview'

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return children
}

const AuthRedirect = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const redirect = params.get('redirect')
  return isAuthenticated ? <Navigate to={redirect || '/'} replace /> : children
}

const AdminRoute = ({ children }) => {
  const user = useAuthStore((state) => state.user)
  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />
  }
  return children
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          element={
            <ProtectedRoute>
              <Shell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Content />} />
          <Route
            path="/users"
            element={
              <AdminRoute>
                <UserManagement />
              </AdminRoute>
            }
          />
          <Route
            path="/shares"
            element={
              <AdminRoute>
                <ShareManage />
              </AdminRoute>
            }
          />
          <Route
            path="/apikeys"
            element={
              <AdminRoute>
                <ApiKeyManage />
              </AdminRoute>
            }
          />
        </Route>
        <Route
          path="/login"
          element={
            <AuthRedirect>
              <Login />
            </AuthRedirect>
          }
        />
        <Route path="/preview/:token" element={<SharePreview />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
