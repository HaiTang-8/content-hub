import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { LogOut, Menu, ShieldCheck, Users, Share2 } from 'lucide-react'
import { useAuthStore } from '../store/auth'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'

const Shell = () => {
  const { user, logout } = useAuthStore()
  // 使用本地状态记录移动端导航是否展开，避免顶部导航在小屏幕上挤在一起
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)

  const navItems = [
    { to: '/', label: '内容', icon: ShieldCheck },
    { to: '/users', label: '用户管理', icon: Users, adminOnly: true },
    { to: '/shares', label: '分享管理', icon: Share2, adminOnly: true },
  ]

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-screen-2xl items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white font-semibold">CH</div>
            <div>
              <p className="text-base font-semibold text-slate-900">Content Hub</p>
              <p className="text-xs text-slate-500">文件 / 文字的简洁空间</p>
            </div>
          </div>
          {/* 桌面端导航：保持原有的横向导航形式，仅在中等及以上屏幕展示 */}
          <nav className="hidden items-center gap-2 md:flex">
            {navItems
              .filter((item) => !item.adminOnly || user?.role === 'admin')
              .map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end
                    className={({ isActive }) =>
                      [
                        'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition',
                        isActive ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-100',
                      ].join(' ')
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                )
              })}
          </nav>
          <div className="flex-1" />
          <div className="hidden items-center gap-3 text-sm text-slate-600 md:flex">
            <Badge>
              {user?.username} · {user?.role}
            </Badge>
            <Button variant="outline" onClick={logout} className="gap-2">
              <LogOut className="h-4 w-4" /> 退出
            </Button>
          </div>
          {/* 移动端操作区：右侧显示菜单按钮和退出按钮，避免与标题和导航挤在同一行 */}
          <div className="flex items-center gap-2 md:hidden">
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => setIsMobileNavOpen((prev) => !prev)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Button variant="outline" onClick={logout} className="gap-2">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* 移动端下拉导航：从顶部展开纵向菜单，保证在小屏幕上有良好的可点击区域 */}
        {isMobileNavOpen && (
          <div className="border-t border-slate-200 bg-white md:hidden">
            <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-1 px-4 py-2">
              {/* 移动端补充用户信息，保证在折叠菜单中也能看到当前登录账号 */}
              {user && (
                <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                  <span>{user.username}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                    {user.role}
                  </span>
                </div>
              )}
              {navItems
                .filter((item) => !item.adminOnly || user?.role === 'admin')
                .map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end
                      onClick={() => setIsMobileNavOpen(false)}
                      className={({ isActive }) =>
                        [
                          'flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition',
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-slate-600 hover:bg-slate-100',
                        ].join(' ')
                      }
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </div>
                    </NavLink>
                  )
                })}
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-screen-2xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

export default Shell
