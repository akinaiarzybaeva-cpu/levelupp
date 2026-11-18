import type { Dispatch, SetStateAction } from 'react'
import { CheckCircle2, Languages, LogOut, Moon, ShieldCheck, Sun } from 'lucide-react'
import { pick, type Lang, type Theme, type UserProfile, type translations } from '../appShared'
import { Button } from './ui'

/** "Preferences" tab of the profile: interface language, theme and account details / actions. */
export default function ProfileSettings({ t, language, setLanguage, theme, setTheme, user, joinedAt, onChangePassword, onLogout }: {
  t: (typeof translations)[Lang]
  language: Lang
  setLanguage: Dispatch<SetStateAction<Lang>>
  theme: Theme
  setTheme: Dispatch<SetStateAction<Theme>>
  user: UserProfile | null
  joinedAt: string
  onChangePassword: () => void
  onLogout: () => void
}) {
  return (
    <div className="profile-grid settings-main-grid">
      <div className="profile-info-block">
        <h3><Languages size={20} /> {pick(language, 'Интерфейстин тили', 'Язык интерфейса', 'Interface language')}</h3>
        <div className="choice-group" role="radiogroup" aria-label={pick(language, 'Интерфейстин тили', 'Язык интерфейса', 'Interface language')}>
          {([['kg', 'Кыргызча'], ['ru', 'Русский'], ['en', 'English']] as const).map(([code, name]) => (
            <button key={code} type="button" role="radio" aria-checked={language === code} className={language === code ? 'choice-option active' : 'choice-option'} onClick={() => setLanguage(code)}>
              <strong>{code.toUpperCase()}</strong><span>{name}</span>{language === code && <CheckCircle2 size={18} />}
            </button>
          ))}
        </div>
        <h3>{theme === 'light' ? <Sun size={20} /> : <Moon size={20} />} {pick(language, 'Тема', 'Тема оформления', 'Theme')}</h3>
        <div className="choice-group two" role="radiogroup" aria-label={pick(language, 'Тема', 'Тема оформления', 'Theme')}>
          {(['light', 'dark'] as const).map((mode) => (
            <button key={mode} type="button" role="radio" aria-checked={theme === mode} className={theme === mode ? 'choice-option active' : 'choice-option'} onClick={() => setTheme(mode)}>
              {mode === 'light' ? <Sun size={18} /> : <Moon size={18} />}
              <span>{mode === 'light' ? pick(language, 'Күндүзгү', 'Дневной', 'Day') : pick(language, 'Түнкү', 'Ночной', 'Night')}</span>
              {theme === mode && <CheckCircle2 size={18} />}
            </button>
          ))}
        </div>
      </div>
      <div className="profile-info-block">
        <h3><ShieldCheck size={20} /> {pick(language, 'Аккаунт', 'Настройки аккаунта', 'Account settings')}</h3>
        <div className="profile-meta-card"><span>{t.auth.email}</span><strong>{user?.email ?? '—'}</strong></div>
        <div className="profile-meta-card"><span>{pick(language, 'Ролу', 'Роль', 'Role')}</span><strong>{user?.role ?? 'Student'}</strong></div>
        <div className="profile-meta-card"><span>{pick(language, 'Катталуу күнү', 'Дата регистрации', 'Joined')}</span><strong>{joinedAt}</strong></div>
        <Button variant="secondary" block icon={ShieldCheck} onClick={onChangePassword}>{pick(language, 'Сырсөздү өзгөртүү', 'Изменить пароль', 'Change password')}</Button>
        <Button variant="danger" block icon={LogOut} onClick={onLogout}>{t.dashboard.logout}</Button>
      </div>
    </div>
  )
}
