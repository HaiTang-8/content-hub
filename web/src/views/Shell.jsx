import { NavLink, Outlet } from 'react-router-dom'
import { LogOut, ShieldCheck, Users } from 'lucide-react'
import { useAuthStore } from '../store/auth'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'

const Shell = () => {
  const { user, logout } = useAuthStore()

  const navItems = [
    { to: '/', label: '内容', icon: ShieldCheck },
    { to: '/users', label: '用户管理', icon: Users, adminOnly: true },
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
          <nav className="flex items-center gap-2">
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
          <div className="hidden sm:flex items-center gap-3 text-sm text-slate-600">
            <Badge>
              {user?.username} · {user?.role}
            </Badge>
            <Button variant="outline" onClick={logout} className="gap-2">
              <LogOut className="h-4 w-4" /> 退出
            </Button>
          </div>
          <Button variant="outline" onClick={logout} className="sm:hidden gap-2">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-screen-2xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

export default Shell
