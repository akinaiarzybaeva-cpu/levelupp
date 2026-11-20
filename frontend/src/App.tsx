import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, BadgeCheck, Bell, BookOpen, Brain, Check, Clock3, Crown, GraduationCap, HelpCircle, Home, LayoutDashboard, LayoutGrid, Lock, Mail, Menu, MessageSquareText, Moon, Search, SendHorizonal, Sparkles, Sun, Target, TrendingUp, UserRound, WalletCards, X, ArrowRight, Bot, ChevronRight, Play, Star, Trophy, Users, Award, CheckCircle2, Flame, Lightbulb, ListChecks, PlayCircle, Rocket, RefreshCw, ShieldCheck, SlidersHorizontal, Zap, Building2, CreditCard } from 'lucide-react'
import { Badge, Button, ButtonLink, Card, EmptyState, Modal, PageHero, PasswordInput, ProgressBar, StarRating, StatTile } from './components/ui'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useNavigationType, useParams, useSearchParams } from 'react-router-dom'
import { API_BASE_URL, AUTH_TOKEN_KEY, getStoredAuthToken, isNetworkError } from './api'
import { courses as bundledCourses, type Course } from './data'
// Optimised 384px WebP of assets/лого.png (826 KB -> ~21 KB); displayed at <=170px wide.
import { ApiError, cancelServerSubscription, createPaymentOrder, getCertificates, type Certificate, type CertificatesResponse, getManualTransferConfig, getPaymentOrderStatus, submitManualTransfer, type ManualTransferConfig, getPlans, getReviewsFromServer, getServerSubscription, getSubscriptionHistory, saveReviewToServer, type SubscriptionHistory } from './paymentApi'
import { archiveExpiredPlans, getDefaultSubscription, getRemainingDays, getUserSubscription, PLAN_META, setUserSubscription, type PaymentMethod, type UserSubscription } from './subscriptionService'
import AdminLogin from './components/AdminLogin'
import PaymentModal, { useDemoPaymentEnabled } from './components/PaymentModal'
import PurchaseModal from './components/PurchaseModal'
import AdminResetPassword from './components/AdminResetPassword'
import './components/AdminPanel.css'

// The admin panel is large and only used by the administrator, so it is loaded on demand.
const AdminPanel = lazy(() => import('./components/AdminPanel'))

import { planPeriodLabel, defaultNotificationSettings, defaultReviews, faqData, translations,getStoredValue, setStoredValue, getStoredLastAuthEmail, setStoredLastAuthEmail, resolveSafeNextPath, appendFromParam, fetchJson, formatCompactNumber, AnimatedMetric, SmartBackButton, isAdminRole, sanitizeReviews, buildReviewLessonOptions, createEmptyProgress, renderAvatarContent, buildLeaderboard, getCurrentUserProgress, LanguageContext, LanguageSetterContext, useLanguage, pick, levelLabel, normalizeLanguage, buildCourseCatalog, CourseCatalogContext, useCourseCatalog, bundledPlans, PLAN_RANK, GUEST_LESSON_LIMIT, BillingContext, useBilling, accessPlanOf, useLessonLimit, formatDateTime, subscriptionStatusText, paymentStatusText, historyEventText, UpgradeRequiredModal, mapApiCourse, hasActiveAiAccess, type Lang, type Theme, type UserProfile, type NotificationSettings, type UserProgress, type SiteStats, type LeaderboardEntry, type Review, type CourseCatalog, type ApiCourse, type PlanView, type BillingState } from './appShared'
import HeroSection, { HeroIllustration } from './components/HeroSection'
import Sidebar from './components/Sidebar'
import Logo from './components/Logo'
import LoginForm, { type AuthErrors, type AuthFormState } from './components/LoginForm'
import RegisterForm from './components/RegisterForm'
import ForgotPassword from './components/ForgotPassword'
import LessonVideo from './components/LessonVideo'
import LessonNavigation from './components/LessonNavigation'
import LessonCard from './components/LessonCard'
import SearchBar from './components/SearchBar'
import CourseList from './components/CourseList'
import Notification from './components/Notification'
import UserProfileCard from './components/UserProfile'
import ProfileSettings from './components/ProfileSettings'
import Header from './components/Header'
import { formatWeeks, MobileCatalogHeading, MobileHeroCard, MobileMyLessons, MobilePopularCourses, MobileQuickNav, MobileStatsCard } from './components/MobileHome'
import AIChat from './components/AIChat'
import PricingCard, { PlanComparison } from './components/PricingCard'
import FAQAccordion from './components/FAQAccordion'
import ReviewCard from './components/ReviewCard'
import CourseCategories, { CourseDirectionIcon } from './components/CourseCategories'
import Footer from './components/Footer'

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}

function AppShell() {
  const navigate = useNavigate()
  const [language, setLanguage] = useState<Lang>(() => normalizeLanguage(getStoredValue('levelup-language', 'ru')))
  // The site always opens (and re-opens after a refresh) in Light Mode. Dark Mode can be switched on
  // manually and lasts until the page is reloaded: it is intentionally not restored from storage
  // or from the system colour-scheme preference.
  const [theme, setTheme] = useState<Theme>('light')
  const [catalog, setCatalog] = useState<CourseCatalog>(() => buildCourseCatalog(bundledCourses))
  const courses = catalog.courses
  const [authToken, setAuthToken] = useState<string>(() => getStoredAuthToken())
  // True while a stored token is being verified, so protected pages wait instead of
  // redirecting a logged-in user away on a deep link / page reload.
  const [sessionPending, setSessionPending] = useState<boolean>(() => Boolean(getStoredAuthToken()))
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => getStoredValue('levelup-auth', false))
  const [user, setUser] = useState<UserProfile | null>(() => getStoredValue('levelup-user', null as UserProfile | null))
  const [favorites, setFavorites] = useState<string[]>(() => getStoredValue('levelup-favorites', [] as string[]))
  const [completedLessons, setCompletedLessons] = useState<string[]>(() => getStoredValue('levelup-completed', [] as string[]))
  const [userProgress, setUserProgress] = useState<Record<string, UserProgress>>(() => getStoredValue('levelup-progress', {} as Record<string, UserProgress>))
  const [subscriptions, setSubscriptions] = useState<Record<string, UserSubscription>>(() => getStoredValue('levelup-subscriptions', {} as Record<string, UserSubscription>))
  const [reviews, setReviews] = useState<Review[]>(() => sanitizeReviews(getStoredValue('levelup-reviews', defaultReviews)))
  const [notifications, setNotifications] = useState<NotificationSettings>(() => getStoredValue('levelup-notifications', defaultNotificationSettings))
  const [siteStats, setSiteStats] = useState<SiteStats>({
    students: 0,
    completion: 0,
    rating: 0,
    totalRatings: 0,
    startedCourses: 0,
    completedCourses: 0,
    loading: true
  })
  const t = translations[language]
  const allUsers = useMemo(() => getStoredValue<UserProfile[]>('levelup-users', []), [user?.email, user?.name, isLoggedIn])
  const leaderboard = useMemo(() => buildLeaderboard(allUsers, userProgress), [allUsers, userProgress])
  const currentUserLessons = user ? (userProgress[user.email]?.lessonsCompleted ?? []) : completedLessons
  const currentUserSubscription = user ? (subscriptions[user.email] ?? getUserSubscription(user.email)) : getDefaultSubscription('free')
  const catalogAccessKey = `${accessPlanOf(currentUserSubscription)}:${isAdminRole(user?.role) ? 'admin' : ''}`
  const location = useLocation()
  const isDashboardRoute = location.pathname.startsWith('/dashboard')

  const refreshSiteStats = useCallback(async () => {
    try {
      setSiteStats((current) => ({ ...current, loading: true }))
      const payload = await fetchJson<{ students: number; completion: number; rating: number; totalRatings: number; startedCourses: number; completedCourses: number; updatedAt?: string }>(`${API_BASE_URL}/api/site-stats`)
      setSiteStats({
        students: Number(payload.students ?? 0),
        completion: Number(payload.completion ?? 0),
        rating: Number(payload.rating ?? 0),
        totalRatings: Number(payload.totalRatings ?? 0),
        startedCourses: Number(payload.startedCourses ?? 0),
        completedCourses: Number(payload.completedCourses ?? 0),
        updatedAt: payload.updatedAt,
        loading: false
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`Failed to sync site stats from backend: ${message}`)
      setSiteStats((current) => ({ ...current, loading: false }))
    }
  }, [])

  useEffect(() => {
    let active = true
    const loadCourses = async () => {
      try {
        const payload = await fetchJson<{ courses?: ApiCourse[] }>(`${API_BASE_URL}/api/courses`)
        // Courses without lessons cannot be opened, so they are not listed publicly.
        const mapped = (payload.courses ?? []).map(mapApiCourse).filter((course) => course.lessons.length > 0)
        if (active && mapped.length > 0) setCatalog(buildCourseCatalog(mapped))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.warn(`Using bundled course data; backend course list unavailable: ${message}`)
      }
    }
    void loadCourses()
    return () => { active = false }
  }, [authToken, catalogAccessKey])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
  }, [theme])

  // Older versions saved the theme; that value is no longer used, so it is removed.
  useEffect(() => {
    try { window.localStorage.removeItem('levelup-theme') } catch { /* storage unavailable */ }
  }, [])

  useEffect(() => {
    setStoredValue('levelup-language', language)
    document.documentElement.lang = language === 'kg' ? 'ky' : language
  }, [language])

  useEffect(() => {
    setStoredValue('levelup-auth', isLoggedIn)
    if (isLoggedIn && user) {
      setStoredValue('levelup-user', user)
    } else if (typeof window !== 'undefined') {
      window.localStorage.removeItem('levelup-user')
    }
  }, [isLoggedIn, user])

  useEffect(() => {
    if (!authToken) {
      if (typeof window !== 'undefined') window.localStorage.removeItem(AUTH_TOKEN_KEY)
      return
    }
    // Store the raw token. (It used to go through setStoredValue, which JSON-encodes,
    // so the stored value had quotes and every request reading it got a 401.)
    window.localStorage.setItem(AUTH_TOKEN_KEY, authToken)
  }, [authToken])

  useEffect(() => {
    if (!authToken) {
      setIsLoggedIn(false)
      setUser(null)
      setSessionPending(false)
      return
    }

    let active = true
    const restoreSession = async () => {
      try {
        const data = await fetchJson<{ ok: true; user?: { email: string; name: string; firstName?: string; lastName?: string; phone?: string; bio?: string; avatar?: string; role?: string; createdAt?: string; accountStatus?: string; isBlocked?: boolean } }>(`${API_BASE_URL}/api/auth/session`, {
          headers: { Authorization: `Bearer ${authToken}` }
        })

        if (!active || !data.user) return

        const nextUser: UserProfile = {
          name: data.user.name,
          email: data.user.email,
          password: '',
          avatar: data.user.avatar ? 'U' : (data.user.name?.charAt(0)?.toUpperCase() || 'U'),
          role: data.user.role ?? 'User',
          firstName: data.user.firstName ?? '',
          lastName: data.user.lastName ?? '',
          phone: data.user.phone ?? '',
          bio: data.user.bio ?? '',
          profileImage: data.user.avatar ?? '',
          createdAt: data.user.createdAt
        }

        setUser(nextUser)
        setStoredLastAuthEmail(nextUser.email)
        setIsLoggedIn(true)
        setSessionPending(false)
      } catch (error) {
        if (!active) return
        const message = error instanceof Error ? error.message : String(error)
        const isAuthRejection = /401|403|Session expired|invalid|unauthorized|suspended|not found/i.test(message)
        setSessionPending(false)
        if (!isAuthRejection) {
          // Network error / backend waking up: keep the session and cached profile
          // instead of logging the user out.
          console.error('Session restore failed (keeping local session):', error)
          return
        }
        setIsLoggedIn(false)
        setUser(null)
        if (typeof window !== 'undefined') window.localStorage.removeItem(AUTH_TOKEN_KEY)
        setAuthToken('')
      }
    }

    void restoreSession()
    return () => { active = false }
  }, [authToken])

  useEffect(() => { setStoredValue('levelup-favorites', favorites) }, [favorites])
  useEffect(() => { setStoredValue('levelup-completed', completedLessons) }, [completedLessons])
  useEffect(() => { setStoredValue('levelup-progress', userProgress) }, [userProgress])
  useEffect(() => { setStoredValue('levelup-subscriptions', subscriptions) }, [subscriptions])
  useEffect(() => { setStoredValue('levelup-reviews', reviews) }, [reviews])
  useEffect(() => { setStoredValue('levelup-notifications', notifications) }, [notifications])

  useEffect(() => {
    if (isLoggedIn && !user && !sessionPending) {
      setIsLoggedIn(false)
    }
  }, [isLoggedIn, user, sessionPending])

  useEffect(() => {
    if (!user?.email) return
    const active = getUserSubscription(user.email)
    const normalized = archiveExpiredPlans(user.email) ?? active
    setSubscriptions((current) => {
      const next = { ...current, [user.email]: normalized }
      if (JSON.stringify(current[user.email] ?? null) === JSON.stringify(normalized)) return current
      return next
    })
  }, [user?.email])

  useEffect(() => {
    const syncReviews = async () => {
      try {
        const remoteReviews = await getReviewsFromServer()
        setReviews(remoteReviews)
        void refreshSiteStats()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        // eslint-disable-next-line no-console
        console.error(`Failed to sync reviews from backend: ${message}`)
      }
    }

    void syncReviews()
    // Re-sync when the session changes so `isOwn` reflects the logged-in user.
  }, [refreshSiteStats, authToken])

  useEffect(() => {
    if (!user?.email) return
    void refreshSiteStats()
    const syncUserProfile = async () => {
      try {
        const data = await fetchJson<{ user?: { email: string; name: string; firstName?: string; lastName?: string; phone?: string; bio?: string; avatar?: string; role?: string; createdAt?: string }; notifications?: NotificationSettings }>(`${API_BASE_URL}/api/users/${encodeURIComponent(user.email)}`)

        if (data.user) {
          const nextUser: UserProfile = {
            ...user,
            name: data.user.name || user.name,
            firstName: data.user.firstName || user.firstName || data.user.name?.split(' ')[0] || user.name.split(' ')[0] || '',
            lastName: data.user.lastName || user.lastName || data.user.name?.split(' ').slice(1).join(' ') || user.name.split(' ').slice(1).join(' ') || '',
            phone: data.user.phone || user.phone || '',
            bio: data.user.bio || user.bio || '',
            profileImage: data.user.avatar || user.profileImage || '',
            avatar: data.user.avatar ? 'U' : user.avatar,
            role: data.user.role || user.role,
            createdAt: data.user.createdAt || user.createdAt
          }
          setUser(nextUser)
          setStoredValue('levelup-user', nextUser)
        }

        if (data.notifications) {
          setNotifications({
            emailNotifications: Boolean(data.notifications.emailNotifications),
            newCourses: Boolean(data.notifications.newCourses),
            newLessons: Boolean(data.notifications.newLessons),
            newsUpdates: Boolean(data.notifications.newsUpdates)
          })
        }
      } catch (error) {
        console.error('Failed to sync user profile from backend:', error)
      }
    }

    void syncUserProfile()
  }, [refreshSiteStats, user?.email])

  const refreshSubscription = useCallback(async (): Promise<UserSubscription | null> => {
    if (!user?.email) return null
    try {
      const remote = await getServerSubscription(user.email)
      setUserSubscription(user.email, remote)
      setSubscriptions((current) => ({ ...current, [user.email]: remote }))
      return remote
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      // eslint-disable-next-line no-console
      console.error(`Failed to sync subscription from backend: ${message}`)
      return null
    }
  }, [user?.email])

  useEffect(() => {
    if (!user?.email) return
    void refreshSubscription()
    const onFocus = () => { void refreshSubscription() }
    window.addEventListener('focus', onFocus)
    const timer = window.setInterval(() => { void refreshSubscription() }, 5 * 60 * 1000)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.clearInterval(timer)
    }
  }, [refreshSubscription, user?.email])

  // Plans (prices, texts, availability) come from the server; bundled ones are only a fallback.
  const [plans, setPlans] = useState<PlanView[]>(bundledPlans)
  useEffect(() => {
    let active = true
    getPlans()
      .then((list) => {
        if (!active || list.length === 0) return
        setPlans(list.map((plan) => ({
          id: plan.id,
          name: plan.name,
          price: plan.price,
          currency: plan.currency,
          durationDays: plan.durationDays,
          featured: plan.isFeatured,
          label: plan.label,
          description: plan.description,
          features: plan.features
        })))
      })
      .catch((error) => console.warn('Using bundled plans; backend plans unavailable:', error instanceof Error ? error.message : error))
    return () => { active = false }
  }, [])

  // Role comes from the server session; the backend enforces admin rights on every API call.
  const isAdminUser = isAdminRole(user?.role)
  const syncCourseProgress = useCallback(async (courseId: string, completedLessonsInCourse: number, totalLessons: number) => {
    if (!user?.email || !courseId) return

    try {
      await fetchJson<{ ok: true }>(`${API_BASE_URL}/api/course-progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: user.email,
          courseId,
          totalLessons,
          completedLessons: completedLessonsInCourse,
          lessonsStarted: Math.max(1, completedLessonsInCourse)
        })
      })
      void refreshSiteStats()
    } catch (error) {
      console.error('Failed to persist course progress to backend:', error)
    }
  }, [refreshSiteStats, user?.email])

  const awardCourseCompletion = (courseId: string) => {
    if (!user || !user.email) return

    const totalLessons = courses.find((course) => course.id === courseId)?.lessons.length ?? 0
    setUserProgress((current) => {
      const existing = current[user.email] ?? createEmptyProgress()

      if (existing.coursesCompleted.includes(courseId)) return current

      const nextEntry: UserProgress = {
        ...existing,
        coursesCompleted: [...existing.coursesCompleted, courseId],
        totalScore: existing.totalScore + 250,
        achievements: existing.achievements.includes('Course Completed') ? existing.achievements : [...existing.achievements, 'Course Completed'],
        lastUpdated: new Date().toISOString()
      }

      return { ...current, [user.email]: nextEntry }
    })

    if (totalLessons > 0) {
      void syncCourseProgress(courseId, totalLessons, totalLessons)
    }
  }

  const handleLogout = async (redirectTo = '/auth') => {
    const token = getStoredAuthToken() || authToken

    try {
      if (token) {
        await fetchJson<{ ok: true }>(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        })
      }
    } catch (error) {
      console.error('Logout request failed:', error)
    }

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(AUTH_TOKEN_KEY)
      window.localStorage.removeItem('levelup-user')
    }

    setAuthToken('')
    setIsLoggedIn(false)
    setUser(null)
    navigate(redirectTo, { replace: true })
  }

  const completeLessonForCurrentUser = (courseId: string, lessonId: string) => {
    if (!courseId || !lessonId) return

    setCompletedLessons((current) => (current.includes(lessonId) ? current : [...current, lessonId]))
    if (!user?.email) return

    const totalLessons = courses.find((course) => course.id === courseId)?.lessons.length ?? 0
    const nextCompletedCount = Math.min(totalLessons, (userProgress[user.email]?.lessonsCompleted.filter((id) => id.startsWith(`${courseId}-lesson-`)).length ?? 0) + 1)

    setUserProgress((current) => {
      const existing = current[user.email] ?? createEmptyProgress()
      if (existing.lessonsCompleted.includes(lessonId)) return current

      const completedForCourse = existing.lessonsCompleted.filter((id) => id.startsWith(`${courseId}-lesson-`)).length + 1
      const achievements = completedForCourse >= 20 && !existing.achievements.includes('Course Completed')
        ? [...existing.achievements, 'Course Completed']
        : existing.achievements

      const nextEntry: UserProgress = {
        ...existing,
        lessonsCompleted: [...existing.lessonsCompleted, lessonId],
        totalScore: existing.totalScore + 25,
        achievements,
        lastUpdated: new Date().toISOString()
      }

      return { ...current, [user.email]: nextEntry }
    })

    if (totalLessons > 0) {
      void syncCourseProgress(courseId, nextCompletedCount, totalLessons)
    }
  }

  const updateUserProfile = async (profileInput: Partial<UserProfile>): Promise<{ ok: boolean; message: string }> => {
    if (!user?.email) return { ok: false, message: 'Auth required' }

    const nextName = `${profileInput.firstName ?? user.firstName ?? user.name.split(' ')[0] ?? ''}`.trim() + ` ${profileInput.lastName ?? user.lastName ?? user.name.split(' ').slice(1).join(' ') ?? ''}`.trim()
    const safeName = nextName.trim()
    if (!safeName || safeName.length < 2) return { ok: false, message: pick(language, 'Атыңызды туура жазыңыз', 'Введите корректное имя', 'Enter a valid name') }

    const normalizedUser: UserProfile = {
      ...user,
      name: safeName,
      firstName: profileInput.firstName ?? user.firstName ?? safeName.split(' ')[0] ?? '',
      lastName: profileInput.lastName ?? user.lastName ?? safeName.split(' ').slice(1).join(' ') ?? '',
      phone: profileInput.phone ?? user.phone ?? '',
      bio: profileInput.bio ?? user.bio ?? '',
      profileImage: profileInput.profileImage ?? user.profileImage ?? user.avatar,
      avatar: profileInput.profileImage ? 'U' : (profileInput.firstName ?? user.firstName ?? user.name).charAt(0).toUpperCase() || 'U'
    }

    // Persist first; only update the UI once the server has accepted the change,
    // so the user is never told "saved" when the save actually failed.
    try {
      await fetchJson<{ ok: true }>(`${API_BASE_URL}/api/users/${encodeURIComponent(user.email)}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: normalizedUser.firstName,
          lastName: normalizedUser.lastName,
          phone: normalizedUser.phone,
          bio: normalizedUser.bio,
          avatarUrl: profileInput.profileImage ?? user.profileImage ?? ''
        })
      })
    } catch (error) {
      console.error('Failed to persist profile to backend:', error)
      return { ok: false, message: error instanceof Error ? error.message : pick(language, 'Профилди сактоо мүмкүн болгон жок', 'Не удалось сохранить профиль', 'Could not save the profile') }
    }

    const allUsers = getStoredValue<UserProfile[]>('levelup-users', [])
    const hasCurrentUser = allUsers.some((entry) => entry.email.toLowerCase() === user.email.toLowerCase())
    const normalizedUsers = hasCurrentUser ? allUsers : [...allUsers, user]
    const updatedUsers = normalizedUsers.map((entry) => (entry.email.toLowerCase() === user.email.toLowerCase() ? { ...entry, ...normalizedUser } : entry))
    setStoredValue('levelup-users', updatedUsers)
    setUser(normalizedUser)

    return { ok: true, message: pick(language, 'Профиль сакталды', 'Профиль сохранён', 'Profile saved') }
  }

  const changeUserPassword = async (currentPassword: string, nextPassword: string, confirmPassword: string): Promise<{ ok: boolean; message: string }> => {
    if (!user?.email) return { ok: false, message: 'Auth required' }
    if (!currentPassword || !nextPassword || !confirmPassword) return { ok: false, message: pick(language, 'Сырсөздүн бардык талааларын толтуруңуз', 'Заполните все поля пароля', 'Fill in all password fields') }
    if (nextPassword.length < 8) return { ok: false, message: pick(language, 'Минимум 8 белги', 'Минимум 8 символов', 'At least 8 characters') }
    if (nextPassword !== confirmPassword) return { ok: false, message: pick(language, 'Жаңы сырсөздөр дал келбейт', 'Новые пароли не совпадают', 'New passwords do not match') }
    if (currentPassword === nextPassword) return { ok: false, message: pick(language, 'Жаңы сырсөз учурдагысынан башка болушу керек', 'Новый пароль должен отличаться от текущего', 'The new password must differ from the current one') }

    try {
      const result = await fetchJson<{ ok: true; sessionsRevoked?: boolean }>(`${API_BASE_URL}/api/users/${encodeURIComponent(user.email)}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword: nextPassword, confirmPassword })
      })

      if (result.sessionsRevoked) {
        // Force logout since all sessions were revoked
        setTimeout(() => {
          void handleLogout('/auth?mode=login')
        }, 1500)
      }

      return { ok: true, message: pick(language, 'Сырсөз ийгиликтүү өзгөртүлдү. Аккаунттан чыгууда...', 'Пароль успешно изменён. Выполняется выход...', 'Password changed. Signing you out...') }
    } catch (error) {
      const message = error instanceof Error ? error.message : pick(language, 'Сырсөздү өзгөртүү мүмкүн болгон жок', 'Пароль не удалось изменить', 'Could not change the password')
      return { ok: false, message }
    }
  }

  const updateUserNotifications = (nextSettings: NotificationSettings) => {
    if (!user?.email) return { ok: false as const, message: 'Auth required' }

    setNotifications(nextSettings)
    setStoredValue('levelup-notifications', nextSettings)

    void fetchJson<{ ok: true }>(`${API_BASE_URL}/api/users/${encodeURIComponent(user.email)}/notifications`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailNotifications: nextSettings.emailNotifications,
        newCourses: nextSettings.newCourses,
        newLessons: nextSettings.newLessons,
        newsUpdates: nextSettings.newsUpdates
      })
    }).catch((error) => {
      console.error('Failed to persist notification settings to backend:', error)
    })

    return { ok: true as const, message: pick(language, 'Эскертүү жөндөөлөрү сакталды', 'Настройки уведомлений сохранены', 'Notification settings saved') }
  }

  const billing = useMemo<BillingState>(() => ({
    plans,
    subscription: currentUserSubscription,
    isLoggedIn,
    isAdmin: isAdminUser,
    userEmail: user?.email ?? null,
    userName: user?.name ?? null,
    refreshSubscription
  }), [plans, currentUserSubscription, isLoggedIn, isAdminUser, user?.email, user?.name, refreshSubscription])

  return (
    <LanguageContext.Provider value={language}>
    <LanguageSetterContext.Provider value={setLanguage}>
    <CourseCatalogContext.Provider value={catalog}>
    <BillingContext.Provider value={billing}>
    <div className="app-shell">
      {!isDashboardRoute && (
        <Header t={t} user={user} isLoggedIn={isLoggedIn} isAdminUser={isAdminUser} onLogout={() => { void handleLogout() }} language={language} setLanguage={setLanguage} theme={theme} setTheme={setTheme} />
      )}

      <main className="page-shell">
        <ScrollToTopOnNavigate />
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/start-learning" element={<StartLearningRedirect />} />
          <Route path="/home" element={<HomePage t={t} reviews={reviews} leaderboard={leaderboard} siteStats={siteStats} completedLessons={currentUserLessons} isLoggedIn={isLoggedIn} />} />
          <Route path="/courses/:courseId/lessons/:lessonId" element={<LessonPage t={t} completedLessons={user ? currentUserLessons : completedLessons} subscription={currentUserSubscription} isLoggedIn={isLoggedIn} onCompleteLesson={completeLessonForCurrentUser} />} />
          <Route path="/courses/:courseId" element={<CourseDetailPage t={t} completedLessons={user ? currentUserLessons : completedLessons} onCourseComplete={awardCourseCompletion} subscription={currentUserSubscription} isLoggedIn={isLoggedIn} />} />
          <Route path="/courses" element={<CourseCatalogPage t={t} siteStats={siteStats} favorites={favorites} onToggleFavorite={setFavorites} completedLessons={user ? currentUserLessons : completedLessons} />} />
          <Route path="/auth" element={<AuthPage t={t} user={user} isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn} setUser={setUser} setAuthToken={setAuthToken} onUserRegistered={refreshSiteStats} />} />
          <Route path="/dashboard" element={<ProtectedRoute isLoggedIn={isLoggedIn} pending={sessionPending}><DashboardPage t={t} user={user} completedLessons={user ? currentUserLessons : completedLessons} subscription={currentUserSubscription} onUpdateProfile={updateUserProfile} onChangePassword={changeUserPassword} reviews={reviews} language={language} setLanguage={setLanguage} theme={theme} setTheme={setTheme} onLogout={() => { void handleLogout() }} /></ProtectedRoute>} />
          <Route path="/dashboard/courses" element={<ProtectedRoute isLoggedIn={isLoggedIn} pending={sessionPending}><CourseCatalogPage t={t} siteStats={siteStats} favorites={favorites} onToggleFavorite={setFavorites} completedLessons={user ? currentUserLessons : completedLessons} /></ProtectedRoute>} />
          <Route path="/dashboard/my-lessons" element={<ProtectedRoute isLoggedIn={isLoggedIn} pending={sessionPending}><DashboardLessonsPage completedLessons={user ? currentUserLessons : completedLessons} language={language} /></ProtectedRoute>} />
          <Route path="/dashboard/rating" element={<ProtectedRoute isLoggedIn={isLoggedIn} pending={sessionPending}><RatingPage t={t} leaderboard={leaderboard} reviews={reviews} currentEmail={user?.email} /></ProtectedRoute>} />
          <Route path="/dashboard/reviews" element={<ProtectedRoute isLoggedIn={isLoggedIn} pending={sessionPending}><ReviewsPage t={t} reviews={reviews} setReviews={setReviews} isLoggedIn={isLoggedIn} user={user} onRefreshSiteStats={refreshSiteStats} /></ProtectedRoute>} />
          <Route path="/dashboard/pricing" element={<ProtectedRoute isLoggedIn={isLoggedIn} pending={sessionPending}><PricingPage t={t} /></ProtectedRoute>} />
          <Route path="/dashboard/faq" element={<ProtectedRoute isLoggedIn={isLoggedIn} pending={sessionPending}><FaqPage t={t} /></ProtectedRoute>} />
          <Route path="/dashboard/ai" element={<ProtectedRoute isLoggedIn={isLoggedIn} pending={sessionPending}><DashboardAiPage language={language} subscription={currentUserSubscription} userEmail={user?.email} /></ProtectedRoute>} />
          <Route path="/dashboard/profile" element={<ProtectedRoute isLoggedIn={isLoggedIn} pending={sessionPending}><ProfilePage t={t} user={user} completedLessons={user ? currentUserLessons : completedLessons} subscription={currentUserSubscription} onUpdateProfile={updateUserProfile} onChangePassword={changeUserPassword} onUpdateNotifications={updateUserNotifications} notifications={notifications} reviews={reviews} language={language} setLanguage={setLanguage} theme={theme} setTheme={setTheme} onLogout={() => { void handleLogout() }} /></ProtectedRoute>} />
          {/* Admin routes — dedicated login and panel */}
          <Route path="/admin/login" element={<AdminLogin isLoggedIn={isLoggedIn} userRole={user?.role} onLogin={(token, adminUser) => {
            setAuthToken(token)
            if (typeof window !== 'undefined') window.localStorage.setItem(AUTH_TOKEN_KEY, token)
            const nextUser: UserProfile = {
              name: adminUser.name,
              email: adminUser.email,
              password: '',
              avatar: adminUser.avatar,
              role: adminUser.role,
              firstName: adminUser.firstName ?? '',
              lastName: adminUser.lastName ?? ''
            }
            setUser(nextUser)
            setIsLoggedIn(true)
            if (typeof window !== 'undefined') window.localStorage.setItem('levelup-user', JSON.stringify(nextUser))
          }} />} />
          <Route path="/admin/reset-password" element={<AdminResetPassword audience="admin" />} />
          <Route path="/reset-password" element={<AdminResetPassword audience="user" />} />
          <Route path="/admin" element={
            <ProtectedAdminRoute isLoggedIn={isLoggedIn} user={user} pending={sessionPending}>
              <Suspense fallback={<div className="container section page-block"><div className="empty-state-box">{t.generic.loading}</div></div>}>
                <AdminPanel user={user ? { name: user.name, email: user.email, avatar: user.avatar, role: user.role } : null} onLogout={() => { void handleLogout('/admin/login') }} />
              </Suspense>
            </ProtectedAdminRoute>
          } />
          <Route path="/rating" element={<RatingPage t={t} leaderboard={leaderboard} reviews={reviews} currentEmail={user?.email} />} />
          <Route path="/reviews" element={<ReviewsPage t={t} reviews={reviews} setReviews={setReviews} isLoggedIn={isLoggedIn} user={user} onRefreshSiteStats={refreshSiteStats} />} />
          <Route path="/pricing" element={<PricingPage t={t} />} />
          <Route path="/pricing/checkout/:planId" element={<ProtectedRoute isLoggedIn={isLoggedIn} pending={sessionPending}><CheckoutPage t={t} user={user} /></ProtectedRoute>} />
          <Route path="/faq" element={<FaqPage t={t} />} />
          <Route path="/privacy" element={<LegalPage title={t.footer.privacy} kind="privacy" />} />
          <Route path="/terms" element={<LegalPage title={t.footer.terms} kind="terms" />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </main>

      <Footer t={t} />
      <MobileBottomNav t={t} isLoggedIn={isLoggedIn} />
    </div>
    </BillingContext.Provider>
    </CourseCatalogContext.Provider>
    </LanguageSetterContext.Provider>
    </LanguageContext.Provider>
  )
}

function SessionCheckPlaceholder() {
  const language = useLanguage()
  return <div className="container section page-block"><div className="empty-state-box">{translations[language].generic.loading}</div></div>
}

function ProtectedRoute({ isLoggedIn, pending = false, children }: { isLoggedIn: boolean; pending?: boolean; children: React.ReactNode }) {
  const location = useLocation()
  if (pending) return <SessionCheckPlaceholder />
  // Remember where the user was going so login brings them back there.
  if (!isLoggedIn) return <Navigate to={`/auth?mode=login&next=${encodeURIComponent(`${location.pathname}${location.search}`)}`} replace />
  return <>{children}</>
}

function ProtectedAdminRoute({ isLoggedIn, user, pending = false, children }: { isLoggedIn: boolean; user: UserProfile | null; pending?: boolean; children: React.ReactNode }) {
  if (pending) return <SessionCheckPlaceholder />
  const isAdmin = Boolean(user && isAdminRole(user.role))

  if (!isLoggedIn) {
    return <Navigate to={`/admin/login?next=${encodeURIComponent('/admin')}`} replace />
  }

  if (!isAdmin) {
    // Regular accounts are sent to the administrator login (the backend also answers 403
    // on every admin API call, so this is only the UI side of the protection).
    return <Navigate to={`/admin/login?next=${encodeURIComponent('/admin')}&reason=forbidden`} replace />
  }

  return <>{children}</>
}
function StartLearningRedirect() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const nextPath = resolveSafeNextPath(searchParams.get('next'), '/courses')

  useEffect(() => {
    let active = true

    const resolveStartFlow = async () => {
      const token = getStoredAuthToken()

      if (token) {
        try {
          await fetchJson<{ ok: true; user: { email: string } }>(`${API_BASE_URL}/api/auth/session`)
          if (active) navigate(nextPath, { replace: true })
          return
        } catch {
          // No active session, continue auth flow selection.
        }
      }

      const lastAuthEmail = getStoredLastAuthEmail()
      const encodedNext = encodeURIComponent(nextPath)
      const authBase = `/auth?next=${encodedNext}`
      const encodedEmail = lastAuthEmail ? `&email=${encodeURIComponent(lastAuthEmail)}` : ''

      if (!lastAuthEmail) {
        if (active) navigate(`${authBase}&mode=register`, { replace: true })
        return
      }

      try {
        const status = await fetchJson<{ exists: boolean }>(`${API_BASE_URL}/api/auth/account-status?email=${encodeURIComponent(lastAuthEmail)}`)
        if (!active) return
        if (status.exists) {
          navigate(`${authBase}&mode=login${encodedEmail}`, { replace: true })
          return
        }
      } catch (error) {
        console.error('Failed to resolve account status:', error)
      }

      if (active) navigate(`${authBase}&mode=register${encodedEmail}`, { replace: true })
    }

    void resolveStartFlow()
    return () => { active = false }
  }, [navigate, nextPath, searchParams])

  return (
    <div className="container section page-block">
      <div className="empty-state-box">Loading...</div>
    </div>
  )
}

function HomePage({ t, reviews, leaderboard, siteStats, completedLessons = [], isLoggedIn = false }: { t: (typeof translations)[Lang]; reviews: Review[]; leaderboard: LeaderboardEntry[]; siteStats: SiteStats; completedLessons?: string[]; isLoggedIn?: boolean }) {
  const { courses } = useCourseCatalog()
  const language = useLanguage()
  const popularCourses = courses.slice(0, 3)
  const { plans: homePlans } = useBilling()
  const highlightedReviews = reviews.slice(0, 3)
  const featuredCourse = popularCourses[0]
  const startLearningLink = `/start-learning?next=${encodeURIComponent(`/courses/${featuredCourse.id}`)}`
  const steps = [
    { title: { kg: 'Катталуу', ru: 'Зарегистрируйся', en: 'Register' }, info: { kg: 'Аккаунт түзүңүз', ru: 'Создай аккаунт', en: 'Create an account' } },
    { title: { kg: 'Курс танда', ru: 'Выбери курс', en: 'Choose a course' }, info: { kg: 'Максатыңызга ылайык курс тандаңыз', ru: 'Подбери курс под цель', en: 'Select a course' } },
    { title: { kg: 'Сабактарды үйрөн', ru: 'Изучай уроки', en: 'Learn lessons' }, info: { kg: 'Практика менен үйрөнүңүз', ru: 'Изучай материал', en: 'Study each lesson' } },
    { title: { kg: 'Тапшырмаларды аткар', ru: 'Выполняй задания', en: 'Complete tasks' }, info: { kg: 'Тесттер жана долбоорлор', ru: 'Решай задания и тесты', en: 'Complete exercises' } },
    { title: { kg: 'Сертификат ал', ru: 'Получи сертификат', en: 'Earn certificate' }, info: { kg: 'Натыйжаңызды бекемдеңиз', ru: 'Зафиксируй результат', en: 'Celebrate success' } }
  ]

  const advantageItems = [
    { icon: GraduationCap, title: { kg: 'Нөлдөн окутуу', ru: 'Обучение с нуля', en: 'Learn from scratch' }, text: { kg: 'Нөлдөн баштап, кадам-кадам', ru: 'Пошаговый старт с нуля', en: 'Start at the beginning' } },
    { icon: Target, title: { kg: 'Практикалык тапшырмалар', ru: 'Практические задания', en: 'Hands-on tasks' }, text: { kg: 'Реалдуу кейстер', ru: 'Реальные кейсы', en: 'Real-world practice' } },
    { icon: LayoutGrid, title: { kg: 'Интерактивдүү сабактар', ru: 'Интерактивные уроки', en: 'Interactive lessons' }, text: { kg: 'Кызыктуу материал', ru: 'Динамичный контент', en: 'Engaging content' } },
    { icon: Clock3, title: { kg: 'Каалаган убакта жеткиликтүү', ru: 'Доступ в любое время', en: 'Anytime access' }, text: { kg: 'Үйде да, жолда да', ru: 'Учитесь в любое время', en: 'Learn anywhere' } },
    { icon: Brain, title: { kg: 'Жасалма интеллекттин жардамы', ru: 'Поддержка искусственного интеллекта', en: 'AI support' }, text: { kg: 'Тез кеңештер', ru: 'Быстрые подсказки', en: 'Fast guidance' } },
    { icon: BadgeCheck, title: { kg: 'Сертификат', ru: 'Сертификаты', en: 'Certificates' }, text: { kg: 'Курсту бүтүргөндөн кийин', ru: 'После завершения', en: 'After completion' } }
  ]

  return (
    <>
      {/* Phones: the first screen of the mobile mockup */}
      <div className="home-mobile-only mobile-home container">
        <MobileHeroCard variant="home" language={language} to="/courses" />
        <MobileQuickNav language={language} isLoggedIn={isLoggedIn} labels={{ home: t.nav.home, courses: t.nav.courses, rating: t.nav.rating, reviews: t.nav.reviews, profile: t.nav.profile }} />
        <MobileMyLessons courses={courses} completedLessons={completedLessons} isLoggedIn={isLoggedIn} language={language} />
        <MobilePopularCourses courses={popularCourses} language={language} />
        <MobileStatsCard siteStats={siteStats} language={language} />
      </div>

      <div className="home-desktop-only">
        <HeroSection t={t} startLearningLink={startLearningLink} />
        <HomeStatsCard t={t} siteStats={siteStats} courseCount={courses.length} />
      </div>

      <section className="section">
        <div className="container">
          <SectionHeading eyebrow={pick(language, 'Артыкчылыктар', 'Преимущества', 'Benefits')} title={t.benefitTitle} />
          <div className="benefits-grid">
            {advantageItems.map(({ icon: Icon, title, text }) => (
              <div className="feature-card" key={title.ru}>
                <div className="feature-icon"><Icon size={22} /></div>
                <div className="feature-text">
                  <h3>{title[language]}</h3>
                  <p>{text[language]}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section categories-section home-desktop-only">
        <div className="container">
          <HomeSectionHeader eyebrow={t.home.categories} title={t.home.directions} linkTo="/courses" linkLabel={t.home.allCourses} />
          <CourseCategories />
        </div>
      </section>

      <section id="popular-courses" className="section alt-bg home-desktop-only">
        <div className="container">
          <div className="home-desktop-only"><HomeSectionHeader eyebrow={t.home.popular} title={t.home.chooseCourse} linkTo="/courses" linkLabel={t.home.viewAll} /></div>
          <div className="home-mobile-only">
            <HomeSectionHeader eyebrow={t.home.popular} title={t.home.chooseCourse} linkTo="/courses" linkLabel={t.home.viewAll} />
            <div className="home-course-list">
              {popularCourses.map((course, index) => (
                <HomeCourseRow key={course.id} course={course} t={t} isTop={index === 0} />
              ))}
            </div>
          </div>
          <CourseList courses={popularCourses} language={language} className="course-grid home-grid home-desktop-only" />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHeading eyebrow={pick(language, 'Кадамдар', 'Шаги', 'Steps')} title={t.startTitle} />
          <div className="steps-grid">
            {steps.map((step, index) => (
              <div className="step-card" key={step.title.ru}>
                <span className="step-number">0{index + 1}</span>
                <div className="step-text">
                  <h3>{step.title[language]}</h3>
                  <p>{step.info[language]}</p>
                </div>
                <ChevronRight size={20} className="step-go" aria-hidden="true" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section alt-bg">
        <div className="container">
          <HomeSectionHeader eyebrow={t.nav.rating} title={t.leaderboardTitle} linkTo="/rating" linkLabel={t.home.viewAll} />
          {leaderboard.length === 0 ? (
            <EmptyState icon={Trophy}>{t.messages.emptyLeaderboard}</EmptyState>
          ) : (
            <div className="leaderboard-grid">
              {leaderboard.slice(0, 5).map((item, index) => (
                <div className={index < 3 ? 'leaderboard-card top' : 'leaderboard-card'} key={item.id}>
                  <div className="rank">{index === 0 ? <Crown size={16} /> : null}#{index + 1}</div>
                  <div className="avatar small">{renderAvatarContent(item.avatar, item.name?.charAt(0)?.toUpperCase() || 'U')}</div>
                  <div>
                    <h4>{item.name}</h4>
                    <p>{item.courses} {pick(language, 'курс', 'курсов', 'courses')}</p>
                  </div>
                  <strong>{item.score}<small> {pick(language, 'упай', 'баллов', 'pts')}</small></strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <HomeSectionHeader eyebrow={t.nav.reviews} title={t.reviewsTitle} linkTo="/reviews" linkLabel={t.home.viewAll} />
          {highlightedReviews.length === 0 ? (
            <EmptyState icon={MessageSquareText}>{t.messages.emptyReviews}</EmptyState>
          ) : (
            <div className="reviews-grid">
              {highlightedReviews.map((review) => <ReviewCard key={review.id} review={review} language={language} />)}
            </div>
          )}
        </div>
      </section>

      <section className="section alt-bg">
        <div className="container">
          <HomeSectionHeader eyebrow={pick(language, 'Тарифтер', 'Тарифы', 'Plans')} title={t.pricingTitle} linkTo="/pricing" linkLabel={t.home.viewAll} />
          <div className="pricing-grid home-pricing">
            {homePlans.map((plan) => <PricingCard key={plan.id} plan={plan} t={t} language={language} />)}
          </div>
        </div>
      </section>

      <section className="section faq-section">
        <div className="container">
          <SectionHeading eyebrow="FAQ" title={t.faqTitle} />
          <div className="faq-list">
            {faqData.map((item, index) => (
              <FAQAccordion key={item.q[language]} question={item.q[language]} answer={item.a[language]} defaultOpen={index === 0} />
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

function CourseCatalogPage({ t, siteStats, favorites, onToggleFavorite, completedLessons = [] }: { t: (typeof translations)[Lang]; siteStats?: SiteStats; favorites: string[]; onToggleFavorite: React.Dispatch<React.SetStateAction<string[]>>; completedLessons?: string[] }) {
  const { courses } = useCourseCatalog()
  const language = useLanguage()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const fallbackPath = location.pathname.startsWith('/dashboard') ? '/dashboard' : '/'
  const [search, setSearch] = useState(() => String(searchParams.get('search') ?? ''))
  const [category, setCategory] = useState(() => String(searchParams.get('category') ?? 'all'))
  const [level, setLevel] = useState(() => String(searchParams.get('level') ?? 'all'))
  const [sort, setSort] = useState(() => String(searchParams.get('sort') ?? 'popular'))
  const categoryOptions = useMemo(() => Array.from(new Set(courses.map((course) => course.category))), [courses])
  const coursesListPath = `${location.pathname}${location.search}`
  const coursesScrollKey = `levelup-scroll:${coursesListPath}`
  const navigationType = useNavigationType()

  useEffect(() => {
    const next = new URLSearchParams()
    if (search.trim()) next.set('search', search.trim())
    if (category !== 'all') next.set('category', category)
    if (level !== 'all') next.set('level', level)
    if (sort !== 'popular') next.set('sort', sort)
    setSearchParams(next, { replace: true })
  }, [category, level, search, setSearchParams, sort])

  useEffect(() => {
    if (typeof window === 'undefined') return
    // Restore the list position only when coming back (Back/Forward), not when the
    // catalog is opened fresh from a menu or tab, which should start at the top.
    if (navigationType !== 'POP') return
    const stored = window.sessionStorage.getItem(coursesScrollKey)
    if (!stored) return
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: Number(stored) || 0, behavior: 'instant' })
    })
  }, [coursesScrollKey, navigationType])

  useEffect(() => {
    if (typeof window === 'undefined') return
    return () => {
      window.sessionStorage.setItem(coursesScrollKey, String(window.scrollY))
    }
  }, [coursesScrollKey])

  const filteredCourses = useMemo(() => {
    let result = [...courses]
    if (search) result = result.filter((course) => course.title[language].toLowerCase().includes(search.toLowerCase()))
    if (category !== 'all') result = result.filter((course) => course.category === category)
    if (level !== 'all') result = result.filter((course) => course.level === level)
    switch (sort) {
      case 'rating':
        result.sort((a, b) => b.rating - a.rating)
        break
      case 'popular':
        result.sort((a, b) => Number(b.students.replace(/[^\d]/g, '')) - Number(a.students.replace(/[^\d]/g, '')))
        break
      default:
        break
    }
    return result
  }, [category, courses, language, level, search, sort])

  const totalLessons = courses.reduce((sum, course) => sum + course.lessons.length, 0)

  return (
    <div className="container section page-block catalog-page">
      <div className="home-mobile-only">
        <MobileHeroCard variant="catalog" language={language} onClick={() => document.getElementById('catalog-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
        <MobileCatalogHeading language={language} onAll={() => { setSearch(''); setCategory('all'); setLevel('all'); setSort('popular'); document.getElementById('catalog-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }} />
      </div>
      <div className="home-desktop-only">
      <PageHero
        back={<SmartBackButton fallback={fallbackPath} label={pick(language, 'Кайтуу', 'Назад', 'Back')} />}
        eyebrow={pick(language, 'Каталог', 'Каталог', 'Catalog')}
        title={t.nav.courses}
        subtitle={pick(language, 'Программалоо, дизайн, AI жана башка багыттар — өз темпиңизде үйрөнүңүз.', 'Программирование, дизайн, AI и другие направления — учитесь в своём темпе.', 'Programming, design, AI and more — learn at your own pace.')}
        aside={(
          <div className="ui-hero-chips">
            <span><BookOpen size={16} /> {courses.length} {pick(language, 'курс', 'курсов', 'courses')}</span>
            <span><PlayCircle size={16} /> {totalLessons} {t.home.lessons}</span>
          </div>
        )}
      />
      </div>
      <div className="toolbar catalog-toolbar">
        <SearchBar value={search} onChange={setSearch} placeholder={t.catalog.search} ariaLabel={t.catalog.search} />
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label={t.catalog.category}>
          <option value="all">{t.catalog.category}</option>
          {categoryOptions.map((categoryItem) => <option key={categoryItem} value={categoryItem}>{categoryItem}</option>)}
        </select>
        <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label={t.catalog.level}>
          <option value="all">{t.catalog.level}</option>
          {(['Beginner', 'Intermediate', 'Advanced'] as const).map((item) => <option key={item} value={item}>{levelLabel(item, language)}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label={pick(language, 'Иреттөө', 'Сортировка', 'Sort')}>
          <option value="popular">{pick(language, 'Популярдуу', 'Популярные', 'Popular')}</option>
          <option value="rating">{pick(language, 'Рейтинг боюнча', 'По рейтингу', 'By rating')}</option>
        </select>
      </div>
      <div className="category-chips" role="group" aria-label={t.catalog.category}>
        <SlidersHorizontal size={16} aria-hidden="true" />
        {['all', ...categoryOptions].map((item) => (
          <button key={item} type="button" className={category === item ? 'category-chip active' : 'category-chip'} aria-pressed={category === item} onClick={() => setCategory(item)}>
            {item === 'all' ? pick(language, 'Баары', 'Все', 'All') : item}
          </button>
        ))}
      </div>
      <p className="catalog-count" id="catalog-list">{pick(language, 'Табылды', 'Найдено', 'Found')}: <strong>{filteredCourses.length}</strong></p>
      <CourseList
        courses={filteredCourses}
        language={language}
        emptyText={pick(language, 'Эч нерсе табылган жок. Фильтрлерди өзгөртүп көрүңүз.', 'Ничего не найдено. Попробуйте изменить фильтры.', 'Nothing found. Try changing the filters.')}
        favorites={favorites}
        onToggleFavorite={onToggleFavorite}
        backTo={coursesListPath}
        completedLessons={completedLessons}
      />
      {siteStats && <div className="home-mobile-only"><MobileStatsCard siteStats={siteStats} language={language} /></div>}
    </div>
  )
}

function CourseDetailPage({ t, completedLessons, onCourseComplete, subscription: _subscription, isLoggedIn }: { t: (typeof translations)[Lang]; completedLessons: string[]; onCourseComplete?: (courseId: string) => void; subscription?: UserSubscription; isLoggedIn: boolean }) {
  const { courseIndex } = useCourseCatalog()
  const language = useLanguage()
  const { courseId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const course = courseIndex[courseId ?? '']
  const fallbackCourseList = location.pathname.startsWith('/dashboard') ? '/dashboard/courses' : '/courses'
  const courseListPath = resolveSafeNextPath(searchParams.get('from'), fallbackCourseList)
  const courseDetailPath = `${location.pathname}${location.search}`
  const lessonPath = (targetLessonId: string) => appendFromParam(`/courses/${courseId}/lessons/${targetLessonId}`, courseDetailPath)
  const [lockedLesson, setLockedLesson] = useState<string | null>(null)
  const [lockedReason, setLockedReason] = useState<'auth' | 'sequence' | 'plan'>('auth')
  const lessonLimit = useLessonLimit()
  useEffect(() => {
    if (!course) return
    if (course.lessons.every((lesson) => completedLessons.includes(lesson.id))) {
      onCourseComplete?.(course.id)
    }
  }, [completedLessons, course, onCourseComplete])

  if (!course) return <Navigate to="/courses" replace />

  const completedCount = course.lessons.filter((lesson) => completedLessons.includes(lesson.id)).length
  const nextLesson = course.lessons[completedCount] ?? course.lessons[0]

  return (
    <div className="container section page-block">
      <div className="page-top-actions">
        <SmartBackButton fallback={courseListPath} label={language === 'ru' ? 'Назад к курсам' : language === 'kg' ? 'Курстарга кайтуу' : 'Back to courses'} />
      </div>
      <div className="breadcrumbs" aria-label="Breadcrumb">
        <Link to={courseListPath}>{t.nav.courses}</Link>
        <span>/</span>
        <span>{course.title[language]}</span>
      </div>
      <UpgradeRequiredModal open={lockedReason === 'plan' && !!lockedLesson} onClose={() => setLockedLesson(null)} />
      <Modal
        open={!!lockedLesson && lockedReason !== 'plan'}
        onClose={() => setLockedLesson(null)}
        icon={Lock}
        title={lockedReason === 'auth' ? t.auth.login : t.buttons.nextLesson}
        actions={(
          <>
            <Button variant="secondary" size="sm" onClick={() => setLockedLesson(null)}>{pick(language, 'Жабуу', 'Закрыть', 'Close')}</Button>
            {lockedReason === 'auth'
              ? <ButtonLink size="sm" to={`/auth?mode=login&next=${encodeURIComponent(lessonPath(lockedLesson ?? course.lessons[0].id))}`}>{t.auth.login}</ButtonLink>
              : <Button size="sm" onClick={() => navigate(lessonPath(course.lessons[Math.max(0, course.lessons.findIndex((item) => item.id === lockedLesson) - 1)]?.id ?? course.lessons[0].id))}>{t.sections.previous}</Button>}
          </>
        )}
      >
        <p>{lockedReason === 'auth' ? pick(language, 'Бул сабакты ачуу үчүн кириңиз.', 'Войдите, чтобы открыть этот урок.', 'Log in to open this lesson.') : pick(language, 'Адегенде мурунку сабакты бүтүрүңүз.', 'Сначала завершите предыдущий урок.', 'Complete the previous lesson first.')}</p>
      </Modal>

      <div className="course-hero" style={{ ['--course-accent' as string]: course.accent }}>
        <div className="course-hero-copy">
          <span className="ui-eyebrow">{course.badge}</span>
          <h1>{course.title[language]}</h1>
          <p>{course.description[language]}</p>
          <div className="meta-row">
            <span><SlidersHorizontal size={15} /> {levelLabel(course.level, language)}</span>
            <span><Clock3 size={15} /> {formatWeeks(course.duration, language)}</span>
            <span><Star size={15} fill="currentColor" /> {course.rating}</span>
            <span><Users size={15} /> {course.students}</span>
            <span><PlayCircle size={15} /> {course.lessons.length} {t.home.lessons}</span>
          </div>
          <div className="hero-actions course-actions">
            <button type="button" className="btn btn-primary" onClick={() => {
              navigate(lessonPath(course.lessons[0].id))
            }}><Play size={16} fill="currentColor" /> {t.buttons.begin}</button>
            <button type="button" className="btn btn-secondary" onClick={() => {
              const nextIndex = course.lessons.findIndex((item) => item.id === nextLesson.id)
              if (nextIndex >= lessonLimit || nextLesson.locked) {
                setLockedReason(isLoggedIn ? 'plan' : 'auth')
                setLockedLesson(nextLesson.id)
                return
              }
              const previousLesson = course.lessons[nextIndex - 1]
              if (previousLesson && !completedLessons.includes(previousLesson.id)) {
                setLockedReason('sequence')
                setLockedLesson(nextLesson.id)
                return
              }
              navigate(lessonPath(nextLesson.id))
            }}>{t.buttons.continue}</button>
            <Link to={courseListPath} className="btn btn-ghost"><ArrowLeft size={16} /> {pick(language, 'Курстарга кайтуу', 'Вернуться к курсам', 'Back to courses')}</Link>
          </div>
        </div>
        <div className="course-summary">
          <span className="course-summary-icon"><CourseDirectionIcon courseId={course.id} size={30} /></span>
          <h3>{t.dashboard.progress}</h3>
          <strong>{Math.round((completedCount / course.lessons.length) * 100)}%</strong>
          <ProgressBar value={(completedCount / course.lessons.length) * 100} />
          <p>{completedCount} / {course.lessons.length} {t.dashboard.completed}</p>
        </div>
      </div>

      <div className="grid-detail">
        <div className="detail-card">
          <h3><ListChecks size={20} /> {t.sections.courseProgram}</h3>
          <ul className="check-list">
            {course.outline.map((item) => <li key={item}><CheckCircle2 size={16} /> {item}</li>)}
          </ul>
        </div>
        <div className="detail-card">
          <h3><Lightbulb size={20} /> {t.sections.whatLearn}</h3>
          <div className="tag-cloud">
            {course.tags.map((tag) => <Badge key={tag} tone="neutral" icon={Sparkles}>{tag}</Badge>)}
          </div>
        </div>
      </div>

      <div className="lesson-list">
        <h3><PlayCircle size={20} /> {pick(language, 'Сабактар', 'Уроки курса', 'Course lessons')} <small>{course.lessons.length}</small></h3>
        {course.lessons.map((lesson, index) => {
          const isDone = completedLessons.includes(lesson.id)
          const isLocked = index >= lessonLimit || Boolean(lesson.locked)
          const needsPlan = isLocked && isLoggedIn
          return (
            <button type="button" key={lesson.id} className={isDone ? 'lesson-row complete' : 'lesson-row'} onClick={() => {
              if (isLocked) {
                setLockedReason(isLoggedIn ? 'plan' : 'auth')
                setLockedLesson(lesson.id)
                return
              }
              const previousLesson = course.lessons[index - 1]
              if (previousLesson && !completedLessons.includes(previousLesson.id)) {
                setLockedReason('sequence')
                setLockedLesson(lesson.id)
                return
              }
              navigate(lessonPath(lesson.id))
            }} disabled={false}>
              <span className="lesson-index">{isDone ? <Check size={16} /> : index + 1}</span>
              <span className="lesson-meta"><strong>{lesson.title[language]}</strong><small><Clock3 size={13} /> {lesson.duration} • {lesson.type}</small></span>
              <span className={isLocked ? 'lesson-status locked' : isDone ? 'lesson-status done' : 'lesson-status'}>{isLocked ? <Lock size={14} /> : isDone ? <CheckCircle2 size={14} /> : <Play size={13} fill="currentColor" />} {needsPlan ? 'PRO' : isLocked ? t.auth.login : isDone ? t.generic.done : t.generic.open}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function LessonPage({ t, completedLessons, subscription: _subscription, isLoggedIn, onCompleteLesson }: { t: (typeof translations)[Lang]; completedLessons: string[]; subscription?: UserSubscription; isLoggedIn: boolean; onCompleteLesson?: (courseId: string, lessonId: string) => void }) {
  const { courseIndex } = useCourseCatalog()
  const language = useLanguage()
  const { courseId, lessonId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const course = courseIndex[courseId ?? '']
  const lessonIndex = course?.lessons.findIndex((lesson) => lesson.id === lessonId) ?? -1
  const lesson = course?.lessons[lessonIndex]
  const safeLessonId = lesson?.id ?? ''
  const safeDuration = lesson?.duration ?? '20'
  const courseReturnPath = resolveSafeNextPath(searchParams.get('from'), `/courses/${courseId}`)
  const lessonPath = (targetLessonId: string) => appendFromParam(`/courses/${courseId}/lessons/${targetLessonId}`, courseReturnPath)
  const currentLessonPath = `${location.pathname}${location.search}`
  const [watchElapsedSec, setWatchElapsedSec] = useState(0)
  const lessonLimit = useLessonLimit()

  useEffect(() => {
    if (!safeLessonId) return
    setWatchElapsedSec(0)
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000)
      setWatchElapsedSec(elapsed)
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [safeLessonId])

  if (!course || !lesson) return <Navigate to="/courses" replace />

  const accessBlocked = !isLoggedIn && lessonIndex >= GUEST_LESSON_LIMIT
  const planBlocked = isLoggedIn && (lessonIndex >= lessonLimit || Boolean(lesson.locked))
  const isCompleted = completedLessons.includes(lesson.id)
  const watchRequirementSec = Math.min(120, Math.max(20, Number(safeDuration.replace(/[^\d]/g, '')) * 2))
  const watchReady = watchElapsedSec >= watchRequirementSec

  if (planBlocked) {
    return (
      <div className="container section page-block">
        <UpgradeRequiredModal open onClose={() => navigate(courseReturnPath)} />
      </div>
    )
  }

  if (accessBlocked) {
    return (
      <div className="container section page-block">
        <Modal
          open
          onClose={() => navigate(courseReturnPath)}
          icon={Lock}
          title={t.auth.login}
          actions={(
            <>
              <Button variant="secondary" size="sm" icon={ArrowLeft} onClick={() => navigate(courseReturnPath)}>{pick(language, 'Кайтуу', 'Назад', 'Back')}</Button>
              <ButtonLink size="sm" to={`/auth?mode=login&next=${encodeURIComponent(currentLessonPath)}`}>{t.auth.login}</ButtonLink>
            </>
          )}
        >
          <p>{pick(language, '2-20 сабактарды ачуу үчүн кириңиз.', 'Войдите, чтобы открыть уроки 2-20.', 'Log in to unlock lessons 2-20.')}</p>
        </Modal>
      </div>
    )
  }

  const progress = Math.round((completedLessons.filter((id) => id.startsWith(`${course.id}-lesson-`)).length / course.lessons.length) * 100)
  const nextLesson = course.lessons[lessonIndex + 1]
  const previousLesson = course.lessons[lessonIndex - 1]

  return (
    <div className="container section lesson-page">
      <div className="lesson-topbar">
        <SmartBackButton fallback={courseReturnPath} label={language === 'ru' ? 'Назад к урокам' : language === 'kg' ? 'Сабактарга кайтуу' : 'Back to lessons'} />
        <div className="lesson-course-meta">
          <span>{course.title[language]}</span>
          <span className="dot-divider" />
          <span>
            {language === 'ru'
             ? `Урок ${lessonIndex + 1} из ${course.lessons.length}`
             : language === 'kg'
               ? `Сабак ${lessonIndex + 1} / ${course.lessons.length}`
               : `Lesson ${lessonIndex + 1} of ${course.lessons.length}`}
          </span>
        </div>
      </div>
      <div className="breadcrumbs" aria-label="Breadcrumb">
        <Link to={courseReturnPath}>{course.title[language]}</Link>
        <span>/</span>
        <span>{lesson.title[language]}</span>
      </div>

      <div className="lesson-header">
        <div className="lesson-header-copy">
          <span className="eyebrow lesson-eyebrow">{course.title[language]}</span>
          <h1>{lesson.title[language]}</h1>
          <div className="lesson-header-meta">
            <span><PlayCircle size={14} /> {lesson.type}</span>
            <span className="dot-divider" />
            <span><Clock3 size={14} /> {lesson.duration}</span>
            {isCompleted
              ? <Badge tone="green" icon={CheckCircle2}>{pick(language, 'Аякталды', 'Урок завершён', 'Completed')}</Badge>
              : <Badge tone="neutral">{pick(language, 'Аткарылууда', 'В процессе', 'In progress')}</Badge>}
          </div>
        </div>

        <div className="lesson-progress">
          <ProgressBar value={progress} label={pick(language, 'Курстун прогресси', 'Прогресс курса', 'Course progress')} showValue />
        </div>
      </div>

      <div className="lesson-layout">
        <div className="lesson-main">
          <LessonVideo
            lesson={lesson}
            language={language}
            watchElapsedSec={watchElapsedSec}
            watchRequirementSec={watchRequirementSec}
            isCompleted={isCompleted}
            watchReady={watchReady}
            onComplete={() => onCompleteLesson?.(course.id, lesson.id)}
          />

          <LessonNavigation previousLesson={previousLesson} nextLesson={nextLesson} isCompleted={isCompleted} language={language} onOpen={(id) => navigate(lessonPath(id))} />
        </div>

        <aside className="lesson-sidebar">
          <div className="detail-card sidebar-box">
            <div className="sidebar-box-header">
             <h3>{language === 'ru' ? 'Содержание курса' : language === 'kg' ? 'Курс мазмуну' : 'Course content'}</h3>
             <span>{course.lessons.length} {language === 'ru' ? 'уроков' : language === 'kg' ? 'сабак' : 'lessons'}</span>
            </div>

            <div className="nav-buttons">
             {previousLesson && (
               <button type="button" className="btn btn-secondary small" onClick={() => navigate(lessonPath(previousLesson.id))}>
                 {t.sections.previous}
               </button>
             )}

             {nextLesson ? (
               <>
                 <button
                   type="button"
                   className="btn btn-primary small"
                   onClick={() => {
                     if (!completedLessons.includes(lesson.id)) {
                       return
                     }
                     navigate(lessonPath(nextLesson.id))
                   }}
                   disabled={!completedLessons.includes(lesson.id)}
                 >
                   {t.buttons.nextLesson}
                 </button>
                 {!completedLessons.includes(lesson.id) && (
                   <p className="lesson-nav-note">
                     {language === 'ru'
                       ? 'Досмотрите видео, чтобы разблокировать следующий урок.'
                       : language === 'kg'
                         ? 'Кийинки сабакты ачуу үчүн видеону аягына чейин көрүңүз.'
                         : 'Finish the video to unlock the next lesson.'}
                   </p>
                 )}
               </>
             ) : (
               <button type="button" className="btn btn-primary small" onClick={() => navigate('/dashboard')}>{t.sections.done}</button>
             )}
            </div>
          </div>

          <div className="detail-card sidebar-box lesson-content-box">
            <div className="sidebar-box-header compact-header">
             <h3>{t.generic.lessons}</h3>
            </div>
            <div className="sidebar-list">
             {course.lessons.map((item, index) => {
               const isCurrent = item.id === lesson.id
               const isDone = completedLessons.includes(item.id)
               const isLocked = index > 0 && !completedLessons.includes(course.lessons[index - 1]?.id ?? '')

               return (
                 <LessonCard
                   key={item.id}
                   index={index}
                   title={item.title[language]}
                   duration={item.duration}
                   isCurrent={isCurrent}
                   isDone={isDone}
                   isLocked={isLocked}
                   onClick={() => {
                     if (!isLoggedIn && index >= GUEST_LESSON_LIMIT) {
                       navigate(`/auth?mode=login&next=${encodeURIComponent(currentLessonPath)}`)
                       return
                     }
                     if (index >= lessonLimit || item.locked) {
                       navigate('/pricing')
                       return
                     }
                     const previousLessonId = course.lessons[index - 1]?.id
                     if (index > 0 && previousLessonId && !completedLessons.includes(previousLessonId)) {
                       return
                     }
                     navigate(lessonPath(item.id))
                   }}
                   disabled={index > 0 && !completedLessons.includes(course.lessons[index - 1]?.id ?? '')}
                 />
               )
             })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function AuthPage({ t, user, isLoggedIn, setIsLoggedIn, setUser, setAuthToken, onUserRegistered }: { t: (typeof translations)[Lang]; user: UserProfile | null; isLoggedIn: boolean; setIsLoggedIn: React.Dispatch<React.SetStateAction<boolean>>; setUser: React.Dispatch<React.SetStateAction<UserProfile | null>>; setAuthToken: React.Dispatch<React.SetStateAction<string>>; onUserRegistered?: () => Promise<void> | void }) {
  const language = useLanguage()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const requestedNext = resolveSafeNextPath(searchParams.get('next'), '')
  const requestedMode = searchParams.get('mode')
  const requestedEmail = String(searchParams.get('email') ?? '').trim().toLowerCase()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<AuthErrors>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [form, setForm] = useState<AuthFormState>({ name: '', email: '', password: '', confirm: '' })
  const authBackFallback = requestedNext || (location.pathname.startsWith('/dashboard') ? '/dashboard' : '/home')

  useEffect(() => {
    if (requestedMode !== 'login' && requestedMode !== 'register') return
    setMode(requestedMode)
  }, [requestedMode])

  useEffect(() => {
    if (!requestedEmail) return
    setForm((current) => ({ ...current, email: requestedEmail }))
  }, [requestedEmail])

  useEffect(() => {
    if (!isLoggedIn) return
    if (requestedNext) {
      navigate(requestedNext, { replace: true })
      return
    }
    const targetPath = user && isAdminRole(user.role) ? '/admin' : '/dashboard'
    navigate(targetPath, { replace: true })
  }, [isLoggedIn, navigate, requestedNext, user])

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setNotice(null)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const nextErrors: { name?: string; email?: string; password?: string; confirm?: string } = {}

    if (mode === 'register') {
      if (!form.name.trim()) nextErrors.name = pick(language, 'Атыңызды жазыңыз', 'Введите имя', 'Enter your name')
      if (!form.email.trim()) nextErrors.email = pick(language, 'Email жазыңыз', 'Введите email', 'Enter your email')
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = pick(language, 'Туура email жазыңыз', 'Введите корректный email', 'Enter a valid email')
      if (!form.password) nextErrors.password = pick(language, 'Сырсөздү жазыңыз', 'Введите пароль', 'Enter your password')
      else if (form.password.length < 8) nextErrors.password = pick(language, 'Минимум 8 белги', 'Минимум 8 символов', 'At least 8 characters')
      if (!form.confirm) nextErrors.confirm = pick(language, 'Сырсөздү ырастаңыз', 'Подтвердите пароль', 'Confirm your password')
      else if (form.confirm !== form.password) nextErrors.confirm = pick(language, 'Сырсөздөр дал келбейт', 'Пароли не совпадают', 'Passwords do not match')
      if (Object.keys(nextErrors).length) {
        setErrors(nextErrors)
        return
      }
    } else {
      if (!form.email.trim()) nextErrors.email = pick(language, 'Email жазыңыз', 'Введите email', 'Enter your email')
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = pick(language, 'Туура email жазыңыз', 'Введите корректный email', 'Enter a valid email')
      if (!form.password) nextErrors.password = pick(language, 'Сырсөздү жазыңыз', 'Введите пароль', 'Enter your password')
      if (Object.keys(nextErrors).length) {
        setErrors(nextErrors)
        return
      }
    }

    setIsSubmitting(true)
    setNotice(null)

    try {
      if (mode === 'register') {
        const response = await fetchJson<{ ok: true; token?: string; user: { email: string; name: string; firstName?: string; lastName?: string; phone?: string; bio?: string; avatar?: string; role?: string; createdAt?: string; accountStatus?: string; isBlocked?: boolean } }>(`${API_BASE_URL}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name.trim(), email: form.email.trim().toLowerCase(), password: form.password })
        })

        const nextUser: UserProfile = {
          name: response.user.name,
          email: response.user.email,
          password: '',
          avatar: response.user.avatar ? 'U' : (response.user.name?.charAt(0)?.toUpperCase() || 'U'),
          role: response.user.role ?? 'User',
          firstName: response.user.firstName ?? '',
          lastName: response.user.lastName ?? '',
          phone: response.user.phone ?? '',
          bio: response.user.bio ?? '',
          profileImage: response.user.avatar ?? '',
          createdAt: response.user.createdAt
        }

        if (response.token) setAuthToken(response.token)
        setUserSubscription(nextUser.email, getDefaultSubscription('free'))
        setUser(nextUser)
        setStoredLastAuthEmail(nextUser.email)
        setIsLoggedIn(true)
        setStoredValue('levelup-users', [...getStoredValue<UserProfile[]>('levelup-users', []), nextUser])
        void onUserRegistered?.()
        navigate(requestedNext || '/dashboard', { replace: true })
        return
      }

      const response = await fetchJson<{ ok: true; token?: string; user: { email: string; name: string; firstName?: string; lastName?: string; phone?: string; bio?: string; avatar?: string; role?: string; createdAt?: string; accountStatus?: string; isBlocked?: boolean } }>(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.trim().toLowerCase(), password: form.password })
      })

      const nextUser: UserProfile = {
        name: response.user.name,
        email: response.user.email,
        password: '',
        avatar: response.user.avatar ? 'U' : (response.user.name?.charAt(0)?.toUpperCase() || 'U'),
        role: response.user.role ?? 'User',
        firstName: response.user.firstName ?? '',
        lastName: response.user.lastName ?? '',
        phone: response.user.phone ?? '',
        bio: response.user.bio ?? '',
        profileImage: response.user.avatar ?? '',
        createdAt: response.user.createdAt
      }

      if (response.token) setAuthToken(response.token)
      setUserSubscription(nextUser.email, getDefaultSubscription('free'))
      setUser(nextUser)
      setStoredLastAuthEmail(nextUser.email)
      setIsLoggedIn(true)
      navigate(requestedNext || (nextUser.role === 'Admin' ? '/admin' : '/dashboard'), { replace: true })
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : pick(language, 'Кирүүдө ката кетти', 'Ошибка входа', 'Sign-in error')
      const message = isNetworkError(error)
        ? pick(language, 'Сервер азыр жооп бербей жатат (ойгонуп же жаңыланып жатышы мүмкүн). Бир мүнөттөн кийин кайра аракет кылыңыз.', 'Сервер сейчас не отвечает (возможно, он запускается или обновляется). Подождите минуту и попробуйте снова.', 'The server is not responding right now (it may be starting up or updating). Please wait a minute and try again.')
        : rawMessage
      if (mode === 'register' && /already exists/i.test(rawMessage)) {
        setMode('login')
        setNotice(pick(language, 'Мындай аккаунт бар. Кириңиз.', 'Аккаунт уже существует. Войдите в систему.', 'This account already exists. Please log in.'))
      }
      setErrors({ email: message, password: message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="page-top-actions auth-top-actions">
        <SmartBackButton fallback={authBackFallback} label={language === 'ru' ? 'Назад' : language === 'kg' ? 'Кайтуу' : 'Back'} />
      </div>
      <div className="auth-card">
        <div className="auth-visual">
          <Logo imageClassName="auth-logo" />
          <h2>{mode === 'login' ? t.auth.welcomeBack : pick(language, 'LevelUp\'ка кошулуңуз', 'Присоединяйтесь к LevelUp', 'Join LevelUp')}</h2>
          <p>{t.home.subtitle}</p>
          <ul className="auth-benefits">
            <li><CheckCircle2 size={18} /> {pick(language, 'Видео сабактар жана тапшырмалар', 'Видеоуроки и практические задания', 'Video lessons and practice tasks')}</li>
            <li><TrendingUp size={18} /> {pick(language, 'Прогрессти көзөмөлдөө жана рейтинг', 'Прогресс обучения и рейтинг', 'Progress tracking and leaderboard')}</li>
            <li><Bot size={18} /> {pick(language, 'AI жардамчы (AI Pro)', 'AI-ассистент (AI Pro)', 'AI assistant (AI Pro)')}</li>
          </ul>
          <HeroIllustration />
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-tabs">
            <button type="button" className={mode === 'login' ? 'auth-tab active' : 'auth-tab'} onClick={() => setMode('login')}>{t.auth.login}</button>
            <button type="button" className={mode === 'register' ? 'auth-tab active' : 'auth-tab'} onClick={() => setMode('register')}>{t.auth.register}</button>
          </div>

          {mode === 'register' ? (
            <RegisterForm form={form} errors={errors} onChange={updateForm} t={t} language={language} />
          ) : (
            <LoginForm form={form} errors={errors} onChange={updateForm} t={t}>
              <ForgotPassword
                email={form.email}
                t={t}
                language={language}
                disabled={isSubmitting}
                onBusyChange={setIsSubmitting}
                onEmailError={(message) => setErrors({ email: message })}
                onNotice={setNotice}
              />
            </LoginForm>
          )}

          <button type="submit" className="btn btn-primary full-width" disabled={isSubmitting}>
            {isSubmitting ? t.generic.loading : mode === 'login' ? t.auth.login : t.auth.register}
          </button>
          <Notification message={notice} inline />
        </form>
      </div>
    </div>
  )
}

function DashboardPage({ t, user, completedLessons, subscription, onUpdateProfile: _onUpdateProfile, onChangePassword: _onChangePassword, reviews: _reviews, language, setLanguage, theme, setTheme, onLogout }: { t: (typeof translations)[Lang]; user: UserProfile | null; completedLessons: string[]; subscription?: UserSubscription; onUpdateProfile?: (profile: Partial<UserProfile>) => Promise<{ ok: boolean; message: string }>; onChangePassword?: (currentPassword: string, nextPassword: string, confirmPassword: string) => Promise<{ ok: boolean; message: string }>; reviews: Review[]; language: Lang; setLanguage: React.Dispatch<React.SetStateAction<Lang>>; theme: Theme; setTheme: React.Dispatch<React.SetStateAction<Theme>>; onLogout: () => void }) {
  const { courses } = useCourseCatalog()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [aiGateOpen, setAiGateOpen] = useState(false)
  const userName = user?.name ?? 'Student'
  const resolvedSubscription = user ? (subscription ?? getUserSubscription(user.email)) : subscription ?? getDefaultSubscription('free')
  const userProgress = user ? getCurrentUserProgress(user) : createEmptyProgress()
  const completedCount = userProgress.lessonsCompleted.length || completedLessons.length
  const progress = courses.map((course) => {
    const count = course.lessons.filter((lesson) => (user ? userProgress.lessonsCompleted : completedLessons).includes(lesson.id)).length
    return { course, progress: Math.round((count / course.lessons.length) * 100) }
  })
  const overallProgress = progress.length ? Math.round(progress.reduce((sum, item) => sum + item.progress, 0) / progress.length) : 0
  const remainingDays = getRemainingDays(resolvedSubscription)
  const renewalTarget = resolvedSubscription.planId === 'free' ? '/pricing' : `/pricing/checkout/${resolvedSubscription.planId}`
  const subscriptionStatusLabel = resolvedSubscription.status === 'active' ? t.subscription.statusActive : resolvedSubscription.status === 'expired' ? t.subscription.statusExpired : t.subscription.statusInactive
  const subscriptionPlanName = resolvedSubscription.planId === 'free' ? t.subscription.free : resolvedSubscription.planId === 'pro' ? t.subscription.pro : t.subscription.aipro
  const planTag = PLAN_META[resolvedSubscription.planId].name
  const endDateLabel = resolvedSubscription.endsAt ? new Date(resolvedSubscription.endsAt).toLocaleDateString() : '—'
  const isAiUnlocked = hasActiveAiAccess(resolvedSubscription)
  const popularCourses = courses.slice(0, 3)
  const doneIds = user ? userProgress.lessonsCompleted : completedLessons
  // Real data: the most recently completed lessons; before any progress, the first lesson to start.
  const lessonLookup = courses.flatMap((course) => course.lessons.map((lesson, index) => ({ course, lesson, index })))
  const completedEntries = doneIds.map((id) => lessonLookup.find((entry) => entry.lesson.id === id)).filter((entry): entry is (typeof lessonLookup)[number] => Boolean(entry))
  const recentLessons = (completedEntries.length ? completedEntries.slice(-3).reverse() : courses.slice(0, 3).map((course) => ({ course, lesson: course.lessons[0], index: 0 })))
    .filter((entry) => entry.lesson)
    .map(({ course, lesson, index }) => ({ course, lesson, index, done: doneIds.includes(lesson.id) }))
  const finishedCourses = progress.filter((item) => item.progress === 100).length
  const achievements = [
    { icon: Rocket, unlocked: completedCount >= 1, title: pick(language, 'Биринчи кадам', 'Первый шаг', 'First step'), text: pick(language, '1 сабак бүттү', 'Завершён 1 урок', '1 lesson completed') },
    { icon: Flame, unlocked: completedCount >= 10, title: pick(language, 'Ритмде', 'В ритме', 'On a roll'), text: pick(language, '10 сабак бүттү', 'Завершено 10 уроков', '10 lessons completed') },
    { icon: Award, unlocked: finishedCourses >= 1, title: pick(language, 'Курс бүттү', 'Курс пройден', 'Course finished'), text: pick(language, 'Толук курсту бүтүрүү', 'Пройти курс полностью', 'Finish a full course') },
    { icon: Zap, unlocked: isAiUnlocked, title: 'AI Pro', text: pick(language, 'AI жардамчы активдүү', 'AI-ассистент подключён', 'AI assistant active') }
  ]
  const quickActions = [
    { icon: BookOpen, label: pick(language, 'Курстар', 'Каталог курсов', 'Course catalog'), to: '/dashboard/courses' },
    { icon: GraduationCap, label: pick(language, 'Менин сабактарым', 'Мои уроки', 'My lessons'), to: '/dashboard/my-lessons' },
    { icon: Trophy, label: t.nav.rating, to: '/dashboard/rating' },
    { icon: MessageSquareText, label: pick(language, 'Пикир калтыруу', 'Оставить отзыв', 'Leave a review'), to: '/dashboard/reviews' }
  ]

  useEffect(() => {
    setSidebarOpen(false)
  }, [navigate])

  return (
    <div className="dashboard-shell">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        language={language}
        logoutLabel={t.dashboard.logout}
        onAi={() => { if (!isAiUnlocked) { setAiGateOpen(true); return } navigate('/dashboard/ai') }}
        onLogout={onLogout}
      >
        <div className="dashboard-sidebar-card">
          <p>{language === 'ru' ? 'Текущий тариф' : language === 'kg' ? 'Учурдагы тариф' : 'Current plan'}</p>
          <strong>{planTag}</strong>
          <span>{subscriptionStatusLabel}</span>
        </div>
      </Sidebar>

      <div className="dashboard-main-panel">
        <header className="dashboard-topbar">
          <div className="dashboard-topbar-left">
            <button type="button" className="dashboard-mobile-toggle" onClick={() => setSidebarOpen((value) => !value)} aria-label="Toggle sidebar">
              <Menu size={18} />
            </button>
            <SearchBar className="dashboard-search" value={search} onChange={setSearch} placeholder={t.generic.search} />
          </div>

          <div className="dashboard-topbar-actions">
            <Link to="/home" className="dashboard-home-link">
              <Home size={16} />
              <span>{t.nav.home}</span>
            </Link>
            <button type="button" className="dashboard-icon-btn" aria-label="Notifications">
              <Bell size={17} />
            </button>
            <div className="dashboard-language-switch" aria-label="Language switcher">
              {(['kg', 'ru', 'en'] as const).map((item) => (
                <button key={item} type="button" className={language === item ? 'lang active' : 'lang'} onClick={() => setLanguage(item)}>
                  {item.toUpperCase()}
                </button>
              ))}
            </div>
            <button type="button" className="dashboard-icon-btn" aria-label="Toggle theme" onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}>
              {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            <Link to="/dashboard/profile" className="dashboard-profile-button">
              <div className="avatar small">{renderAvatarContent(user?.avatar, user?.name?.charAt(0)?.toUpperCase() ?? 'S')}</div>
              <div>
                <strong>{userName}</strong>
                <span>{user?.role ?? 'Student'}</span>
              </div>
            </Link>
          </div>
        </header>

        <main className="dashboard-content">
          <section className="dashboard-hero">
            <div className="dashboard-hero-copy">
              <span className="eyebrow">LEVEL UP</span>
              <h1>{t.dashboard.greeting} {userName}</h1>
              <p>{language === 'ru' ? 'Продолжайте учиться, отслеживайте прогресс и используйте AI-поддержку в одном месте.' : language === 'kg' ? 'Окууну улантыңыз, прогрессиңизди көзөмөлдөңүз жана AI жардамчыны бир жерден колдонуңуз.' : 'Keep learning, track your progress, and use AI support from one place.'}</p>
              <div className="dashboard-hero-actions">
                <Link to="/courses" className="btn btn-primary">{t.buttons.continue}</Link>
                <Link to="/pricing" className="btn btn-secondary">{t.subscription.changePlan}</Link>
              </div>
            </div>

            <div className="dashboard-plan-card">
              <div className="subscription-tier-pill">{planTag}</div>
              <h3>{subscriptionPlanName}</h3>
              <div className="dashboard-plan-details">
                <div>
                  <span>{language === 'ru' ? 'Окончание' : language === 'kg' ? 'Аяктоо' : 'Ends'}</span>
                  <strong>{endDateLabel}</strong>
                </div>
                <div>
                  <span>{language === 'ru' ? 'Осталось' : language === 'kg' ? 'Калды' : 'Left'}</span>
                  <strong>{remainingDays} {t.generic.days}</strong>
                </div>
              </div>
              <Link to={renewalTarget} className="btn btn-primary full-width">{t.subscription.renew}</Link>
            </div>
          </section>

          <section className="dashboard-metrics">
            <StatTile icon={BookOpen} value={courses.length} label={t.dashboard.courses} />
            <StatTile icon={TrendingUp} value={completedCount} label={t.dashboard.completed} tone="blue" />
            <StatTile icon={Target} value={`${overallProgress}%`} label={t.dashboard.progress} tone="violet" />
            <StatTile icon={Crown} value={userProgress.totalScore} label={t.dashboard.rating} tone="gold" />
          </section>

          <section className="quick-actions" aria-label={pick(language, 'Тез аракеттер', 'Быстрые действия', 'Quick actions')}>
            {quickActions.map(({ icon: Icon, label, to }) => (
              <Link key={to} to={to} className="quick-action"><span><Icon size={20} /></span><strong>{label}</strong><ChevronRight size={18} /></Link>
            ))}
          </section>

          <section className="dashboard-grid-two">
            <div className="detail-card dashboard-compact-card">
              <div className="card-header-row">
                <h3>{language === 'ru' ? 'Популярные курсы' : language === 'kg' ? 'Танымал курстар' : 'Popular courses'}</h3>
                <Link to="/courses" className="text-link">{t.buttons.learnMore}</Link>
              </div>
              <div className="popular-course-list">
                {popularCourses.map((course) => (
                  <Link key={course.id} to={`/courses/${course.id}`} className="popular-course-item">
                    <div className="course-pill" style={{ background: course.color, color: course.accent }}>{course.badge}</div>
                    <div>
                      <strong>{course.title[language]}</strong>
                      <small>{formatWeeks(course.duration, language)}</small>
                    </div>
                    <span>{course.rating} ★</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="detail-card dashboard-compact-card">
              <div className="card-header-row">
                <h3>{language === 'ru' ? 'Последние уроки' : language === 'kg' ? 'Соңку сабактар' : 'Recent lessons'}</h3>
                <Link to="/courses" className="text-link">{t.buttons.continue}</Link>
              </div>
              <div className="recent-lessons-list">
                {recentLessons.map(({ course, lesson, index, done }) => (
                  <Link key={lesson.id} to={`/courses/${course.id}/lessons/${lesson.id}`} className="recent-lesson-item">
                    <div className="mini-avatar" style={{ background: course.accent }}><CourseDirectionIcon courseId={course.id} size={18} /></div>
                    <div>
                      <strong>{lesson.title[language]}</strong>
                      <small>{course.title[language]} · {pick(language, 'Сабак', 'Урок', 'Lesson')} {index + 1}</small>
                    </div>
                    {done ? <CheckCircle2 size={18} className="recent-lesson-done" /> : <PlayCircle size={18} />}
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className="dashboard-grid-two">
            <div className="detail-card dashboard-compact-card">
              <div className="card-header-row">
                <h3>{language === 'ru' ? 'Прогресс обучения' : language === 'kg' ? 'Окуу прогресси' : 'Learning progress'}</h3>
              </div>
              <div className="progress-list">
                {progress.slice(0, 4).map(({ course, progress: percent }) => (
                  <div key={course.id} className="progress-row">
                    <div className="progress-meta">
                      <strong>{course.title[language]}</strong>
                      <small>{percent}%</small>
                    </div>
                    <div className="progress-bar"><span style={{ width: `${percent}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>

            <div id="dashboard-ai-assistant" className="detail-card dashboard-ai-card">
              <div className="card-header-row">
                <h3>{language === 'ru' ? 'AI Assistant' : language === 'kg' ? 'AI Assistant' : 'AI Assistant'}</h3>
                <span className={isAiUnlocked ? 'ai-status' : 'ai-status ai-status-locked'}>{isAiUnlocked ? 'online' : 'locked'}</span>
              </div>
              <p>{isAiUnlocked ? t.ai.ready : t.ai.blocked}</p>
              <Link to={isAiUnlocked ? '/dashboard/ai' : '/dashboard/pricing'} className="btn btn-primary small">{isAiUnlocked ? (language === 'ru' ? 'Открыть чат' : language === 'kg' ? 'Чатты ачуу' : 'Open chat') : t.ai.connectPlan}</Link>
            </div>
          </section>

          <section className="detail-card achievements-card">
            <div className="card-header-row">
              <h3><Award size={20} /> {pick(language, 'Жетишкендиктер', 'Достижения', 'Achievements')}</h3>
              <span className="achievements-count">{achievements.filter((item) => item.unlocked).length}/{achievements.length}</span>
            </div>
            <div className="achievements-grid">
              {achievements.map(({ icon: Icon, unlocked, title, text }) => (
                <div key={title} className={unlocked ? 'achievement unlocked' : 'achievement'}>
                  <span className="achievement-icon">{unlocked ? <Icon size={22} /> : <Lock size={18} />}</span>
                  <strong>{title}</strong>
                  <small>{text}</small>
                </div>
              ))}
            </div>
          </section>

          <SubscriptionPanel />
          <CertificatesPanel />
        </main>
      </div>

      <Modal
        open={aiGateOpen}
        onClose={() => setAiGateOpen(false)}
        icon={Bot}
        title="AI Assistant"
        actions={(
          <>
            <Button variant="secondary" size="sm" onClick={() => setAiGateOpen(false)}>{pick(language, 'Кийинчерээк', 'Позже', 'Later')}</Button>
            <ButtonLink size="sm" to="/dashboard/pricing" onClick={() => setAiGateOpen(false)}>{t.ai.connectPlan}</ButtonLink>
          </>
        )}
      >
        <p>{t.ai.blocked}</p>
      </Modal>
    </div>
  )
}

function DashboardAiPage({ language, subscription, userEmail }: { language: Lang; subscription?: UserSubscription; userEmail?: string }) {
  return (
    <div className="container section page-block">
      <div className="page-top-actions">
        <SmartBackButton fallback="/dashboard" label={language === 'ru' ? 'Назад в Dashboard' : language === 'kg' ? "Dashboard'ка кайтуу" : 'Back to Dashboard'} />
      </div>
      <AIChat language={language} subscription={subscription} userEmail={userEmail} pricingPath="/dashboard/pricing" />
    </div>
  )
}

function DashboardLessonsPage({ completedLessons, language }: { completedLessons: string[]; language: Lang }) {
  const { courses } = useCourseCatalog()
  const progressEntries = courses.map((course) => {
    const doneCount = course.lessons.filter((lesson) => completedLessons.includes(lesson.id)).length
    const percent = Math.round((doneCount / course.lessons.length) * 100)
    return { course, doneCount, percent }
  })

  return (
    <div className="container section page-block">
      <PageHero
        back={<SmartBackButton fallback="/dashboard" label={pick(language, "Dashboard'ка кайтуу", 'Назад в Dashboard', 'Back to Dashboard')} />}
        eyebrow={pick(language, 'Окуу', 'Обучение', 'Learning')}
        title={pick(language, 'Менин сабактарым', 'Мои уроки', 'My lessons')}
        subtitle={pick(language, 'Ар бир курс боюнча прогрессиңиз.', 'Ваш прогресс по каждому курсу.', 'Your progress in every course.')}
      />

      <div className="course-grid my-lessons-grid">
        {progressEntries.map(({ course, doneCount, percent }) => (
          <Card as="article" key={course.id} className="my-course-card">
            <div className="my-course-head">
              <span className="home-course-thumb-icon" style={{ background: course.accent }}><CourseDirectionIcon courseId={course.id} size={24} /></span>
              <div>
                <h3>{course.title[language]}</h3>
                <small>{doneCount}/{course.lessons.length} {pick(language, 'сабак', 'уроков', 'lessons')}</small>
              </div>
              {percent === 100 && <Badge tone="green" icon={CheckCircle2}>{pick(language, 'Бүттү', 'Пройден', 'Done')}</Badge>}
            </div>
            <ProgressBar value={percent} showValue label={pick(language, 'Прогресс', 'Прогресс', 'Progress')} />
            <Link to={`/courses/${course.id}`} className={doneCount > 0 ? 'btn btn-primary full-width' : 'btn btn-secondary full-width'}>{doneCount > 0 ? pick(language, 'Улантуу', 'Продолжить', 'Continue') : pick(language, 'Баштоо', 'Начать', 'Start')} <ArrowRight size={16} /></Link>
          </Card>
        ))}
      </div>
    </div>
  )
}

function ProfilePage({ t, user, completedLessons: _completedLessons, subscription, onUpdateProfile, onChangePassword, onUpdateNotifications, notifications, reviews: _reviews, language, setLanguage, theme, setTheme, onLogout }: { t: (typeof translations)[Lang]; user: UserProfile | null; completedLessons: string[]; subscription?: UserSubscription; onUpdateProfile?: (profile: Partial<UserProfile>) => Promise<{ ok: boolean; message: string }>; onChangePassword?: (currentPassword: string, nextPassword: string, confirmPassword: string) => Promise<{ ok: boolean; message: string }>; onUpdateNotifications?: (settings: NotificationSettings) => { ok: boolean; message: string }; notifications: NotificationSettings; reviews: Review[]; language: Lang; setLanguage: React.Dispatch<React.SetStateAction<Lang>>; theme: Theme; setTheme: React.Dispatch<React.SetStateAction<Theme>>; onLogout: () => void }) {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications' | 'preferences'>('profile')
  const [profileNotice, setProfileNotice] = useState<string | null>(null)
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null)
  const [notificationNotice, setNotificationNotice] = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(notifications)
  const [avatarDraft, setAvatarDraft] = useState<string | null>(null)
  const [avatarCrop, setAvatarCrop] = useState({ scale: 1.18, x: 0, y: 0 })
  const [isSavingAvatar, setIsSavingAvatar] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName ?? user?.name?.split(' ')[0] ?? '',
    lastName: user?.lastName ?? user?.name?.split(' ').slice(1).join(' ') ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    bio: user?.bio ?? '',
    avatar: user?.profileImage ?? user?.avatar ?? ''
  })

  useEffect(() => {
    setProfileForm({
      firstName: user?.firstName ?? user?.name?.split(' ')[0] ?? '',
      lastName: user?.lastName ?? user?.name?.split(' ').slice(1).join(' ') ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      bio: user?.bio ?? '',
      avatar: user?.profileImage ?? user?.avatar ?? ''
    })
  }, [user])

  useEffect(() => {
    setNotifSettings(notifications)
  }, [notifications])

  const resolvedSubscription = user ? getUserSubscription(user.email) : subscription ?? getDefaultSubscription('free')
  const userName = user?.name ?? 'Student'
  const joinedAt = user?.createdAt ? new Date(user.createdAt).toLocaleDateString(language === 'kg' ? 'ky-KG' : language === 'ru' ? 'ru-RU' : 'en-US') : '—'

  const applyCroppedAvatar = async (source: string, crop: { scale: number; x: number; y: number }) => {
    const image = new Image()
    image.src = source

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Image load failed'))
    })

    const canvas = document.createElement('canvas')
    const size = 512
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('Canvas is unavailable')
    }

    context.clearRect(0, 0, size, size)
    context.save()
    context.beginPath()
    context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
    context.closePath()
    context.clip()

    const scaledWidth = image.width * crop.scale
    const scaledHeight = image.height * crop.scale
    const offsetX = (size - scaledWidth) / 2 + crop.x * 2.2
    const offsetY = (size - scaledHeight) / 2 + crop.y * 2.2

    context.drawImage(image, offsetX, offsetY, scaledWidth, scaledHeight)
    context.restore()

    return canvas.toDataURL('image/jpeg', 0.9)
  }

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setProfileNotice(t.profilePhoto.invalidType)
      event.target.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setProfileNotice(t.profilePhoto.invalidSize)
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const nextImage = typeof reader.result === 'string' ? reader.result : ''
      setAvatarDraft(nextImage)
      setAvatarCrop({ scale: 1.18, x: 0, y: 0 })
      setProfileNotice(null)
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  const handleSaveAvatar = async () => {
    if (!avatarDraft) return

    try {
      setIsSavingAvatar(true)
      const nextImage = await applyCroppedAvatar(avatarDraft, avatarCrop)

      const result = await onUpdateProfile?.({
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        phone: profileForm.phone,
        bio: profileForm.bio,
        profileImage: nextImage,
        name: `${profileForm.firstName} ${profileForm.lastName}`.trim(),
        avatar: nextImage
      })

      if (result?.ok) {
        setProfileForm((current) => ({ ...current, avatar: nextImage }))
        setProfileNotice(t.profilePhoto.saved)
        setAvatarDraft(null)
      } else {
        setProfileNotice(result?.message ?? t.generic.error)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t.generic.error
      setProfileNotice(message)
    } finally {
      setIsSavingAvatar(false)
    }
  }

  const handleDeleteAvatar = async () => {
    if (!user || !window.confirm(t.profilePhoto.confirmDelete)) return

    const result = await onUpdateProfile?.({
      firstName: profileForm.firstName,
      lastName: profileForm.lastName,
      phone: profileForm.phone,
      bio: profileForm.bio,
      profileImage: '',
      name: `${profileForm.firstName} ${profileForm.lastName}`.trim(),
      avatar: ''
    })

    if (result?.ok) setProfileForm((current) => ({ ...current, avatar: '' }))
    setProfileNotice(result?.ok ? t.profilePhoto.deleted : result?.message ?? t.generic.error)
    setAvatarDraft(null)
  }

  const tabs = [
    { id: 'profile', label: language === 'ru' ? 'Личная информация' : language === 'kg' ? 'Жеке маалымат' : 'Personal details' },
    { id: 'security', label: language === 'ru' ? 'Безопасность' : language === 'kg' ? 'Коопсуздук' : 'Security' },
    { id: 'notifications', label: language === 'ru' ? 'Уведомления' : language === 'kg' ? 'Эскертүүлөр' : 'Notifications' },
    { id: 'preferences', label: pick(language, 'Интерфейс', 'Интерфейс', 'Interface') }
  ] as const

  return (
    <div className="dashboard-shell">
      <div className="page-top-actions dashboard-inner-back">
        <SmartBackButton fallback="/dashboard" label={language === 'ru' ? 'Назад в Dashboard' : language === 'kg' ? "Dashboard'ка кайтуу" : 'Back to Dashboard'} />
      </div>
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        language={language}
        logoutLabel={t.dashboard.logout}
        homeIcon={Home}
        onAi={() => navigate('/dashboard/ai')}
        onLogout={onLogout}
      />

      <div className="dashboard-main-panel">
        <header className="dashboard-topbar">
          <div className="dashboard-topbar-left">
            <button type="button" className="dashboard-mobile-toggle" onClick={() => setSidebarOpen((value) => !value)} aria-label="Toggle sidebar"><Menu size={18} /></button>
            <label className="dashboard-search"><Search size={16} /><input value={user?.name ?? 'Student'} readOnly placeholder={t.auth.name} /></label>
          </div>
          <div className="dashboard-topbar-actions">
            <Link to="/home" className="dashboard-home-link">
              <Home size={16} />
              <span>{t.nav.home}</span>
            </Link>
            <button type="button" className="dashboard-icon-btn" aria-label="Notifications"><Bell size={17} /></button>
            <div className="dashboard-language-switch" aria-label="Language switcher">
              {(['kg', 'ru', 'en'] as const).map((item) => (
                <button key={item} type="button" className={language === item ? 'lang active' : 'lang'} onClick={() => setLanguage(item)}>{item.toUpperCase()}</button>
              ))}
            </div>
            <button type="button" className="dashboard-icon-btn" aria-label="Toggle theme" onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}>{theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}</button>
            <Link to="/dashboard/profile" className="dashboard-profile-button"><div className="avatar small">{user?.profileImage ? <img src={user.profileImage} alt={userName} className="profile-avatar-image" /> : renderAvatarContent(user?.avatar, user?.name?.charAt(0)?.toUpperCase() ?? 'S')}</div><div><strong>{userName}</strong><span>{user?.role ?? 'Student'}</span></div></Link>
          </div>
        </header>

        <main className="dashboard-content profile-page-content">
          <section className="detail-card profile-card-wrap">
            <UserProfileCard name={userName} role={user?.role} kicker={t.dashboard.title} photo={profileForm.avatar || user?.profileImage || undefined} avatar={user?.avatar} initial={user?.name?.charAt(0)?.toUpperCase()} homeLabel={t.nav.home} />

            <div className="settings-tab-row">
              {tabs.map((tab) => (
                <button key={tab.id} type="button" className={activeTab === tab.id ? 'settings-tab active' : 'settings-tab'} onClick={() => setActiveTab(tab.id)}>
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'profile' && (
              <div className="profile-grid settings-main-grid">
                <div className="profile-info-block">
                  <h3>{language === 'ru' ? 'Личная информация' : language === 'kg' ? 'Жеке маалымат' : 'Personal details'}</h3>
                  <form className="settings-form" onSubmit={async (event) => {
                    event.preventDefault()
                    if (isSavingProfile) return
                    setIsSavingProfile(true)
                    setProfileNotice(null)
                    const result = await onUpdateProfile?.({
                      firstName: profileForm.firstName,
                      lastName: profileForm.lastName,
                      phone: profileForm.phone,
                      bio: profileForm.bio,
                      profileImage: profileForm.avatar,
                      name: `${profileForm.firstName} ${profileForm.lastName}`.trim(),
                    })
                    setIsSavingProfile(false)
                    setProfileNotice(result?.message ?? null)
                  }}>
                    <div className="profile-photo-box">
                      <button type="button" className="profile-photo-trigger" onClick={() => fileInputRef.current?.click()} aria-label={t.profilePhoto.uploadTitle}>
                        <div className="profile-photo-preview">{profileForm.avatar ? <img src={profileForm.avatar} alt="Profile avatar" className="profile-avatar-image" /> : <UserRound size={28} />}</div>
                      </button>
                      <div className="profile-photo-actions">
                        <strong>{t.profilePhoto.uploadTitle}</strong>
                        <small>{t.profilePhoto.cropHint}</small>
                        <div className="profile-photo-buttons">
                          <button type="button" className="btn btn-secondary small" onClick={() => fileInputRef.current?.click()}>{t.profilePhoto.upload}</button>
                          {profileForm.avatar && <button type="button" className="btn btn-secondary small" onClick={() => fileInputRef.current?.click()}>{t.profilePhoto.change}</button>}
                          {profileForm.avatar && <button type="button" className="btn btn-danger small" onClick={() => { void handleDeleteAvatar() }}>{t.profilePhoto.remove}</button>}
                        </div>
                        <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" hidden onChange={handleAvatarUpload} />
                      </div>
                    </div>

                    <div className="two-column-fields">
                      <label><span>{language === 'ru' ? 'Имя' : language === 'kg' ? 'Аты' : 'First name'}</span><input value={profileForm.firstName} onChange={(event) => setProfileForm((current) => ({ ...current, firstName: event.target.value }))} /></label>
                      <label><span>{language === 'ru' ? 'Фамилия' : language === 'kg' ? 'Фамилия' : 'Last name'}</span><input value={profileForm.lastName} onChange={(event) => setProfileForm((current) => ({ ...current, lastName: event.target.value }))} /></label>
                    </div>

                    <label><span>{t.auth.email}</span><input value={profileForm.email} readOnly /></label>
                    <label><span>{language === 'ru' ? 'Номер телефона' : language === 'kg' ? 'Телефон номери' : 'Phone number'}</span><input value={profileForm.phone} onChange={(event) => setProfileForm((current) => ({ ...current, phone: event.target.value }))} placeholder={language === 'ru' ? '+996 555 123 456' : language === 'kg' ? '+996 555 123 456' : '+996 555 123 456'} /></label>
                    <label><span>{language === 'ru' ? 'Информация о пользователе' : language === 'kg' ? 'Өзүңүз жөнүндө' : 'About you'}</span><textarea rows={5} value={profileForm.bio} onChange={(event) => setProfileForm((current) => ({ ...current, bio: event.target.value }))} placeholder={language === 'ru' ? 'Расскажите немного о себе...' : language === 'kg' ? 'Өзүңүз жөнүндө кыскача айтып бериңиз...' : 'Tell us a bit about yourself...'} /></label>
                    <button type="submit" className="btn btn-primary small full-width" disabled={isSavingProfile}>{isSavingProfile ? t.generic.loading : language === 'ru' ? 'Сохранить данные' : language === 'kg' ? 'Маалыматты сактоо' : 'Save information'}</button>
                    <Notification message={profileNotice} inline />
                  </form>

                  {avatarDraft && (
                    <div className="photo-editor-backdrop" role="dialog" aria-modal="true">
                      <div className="photo-editor-card">
                        <div className="photo-editor-header">
                          <h4>{t.profilePhoto.uploadTitle}</h4>
                          <button type="button" className="photo-editor-close" onClick={() => setAvatarDraft(null)} aria-label={t.profilePhoto.cancel}><X size={16} /></button>
                        </div>

                        <div className="photo-editor-crop">
                          <img src={avatarDraft} alt="Upload preview" style={{ transform: `translate(${avatarCrop.x}px, ${avatarCrop.y}px) scale(${avatarCrop.scale})` }} />
                        </div>

                        <div className="photo-editor-controls">
                          <label>
                            <span>{t.profilePhoto.zoom}</span>
                            <input type="range" min="1" max="2.3" step="0.05" value={avatarCrop.scale} onChange={(event) => setAvatarCrop((current) => ({ ...current, scale: Number(event.target.value) }))} />
                          </label>
                          <div className="photo-editor-move">
                            <button type="button" onClick={() => setAvatarCrop((current) => ({ ...current, x: current.x - 12 }))} aria-label="Move left">◀</button>
                            <button type="button" onClick={() => setAvatarCrop((current) => ({ ...current, y: current.y - 12 }))} aria-label="Move up">▲</button>
                            <button type="button" onClick={() => setAvatarCrop((current) => ({ ...current, y: current.y + 12 }))} aria-label="Move down">▼</button>
                            <button type="button" onClick={() => setAvatarCrop((current) => ({ ...current, x: current.x + 12 }))} aria-label="Move right">▶</button>
                          </div>
                        </div>

                        <div className="photo-editor-actions">
                          <button type="button" className="btn btn-secondary small" onClick={() => setAvatarDraft(null)}>{t.profilePhoto.cancel}</button>
                          <button type="button" className="btn btn-primary small" onClick={() => void handleSaveAvatar()} disabled={isSavingAvatar}>{isSavingAvatar ? t.profilePhoto.uploading : t.profilePhoto.save}</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="profile-info-block">
                  <h3>{resolvedSubscription.planId === 'free' ? t.subscription.free : resolvedSubscription.planId === 'pro' ? t.subscription.pro : t.subscription.aipro}</h3>
                  <div className="profile-plan-box">
                    <span className="subscription-tier-pill">{PLAN_META[resolvedSubscription.planId].name}</span>
                    <strong>{resolvedSubscription.endsAt ? new Date(resolvedSubscription.endsAt).toLocaleDateString() : '—'}</strong>
                    <small>{language === 'ru' ? 'Дата окончания подписки' : language === 'kg' ? 'Жазылуунун аякталуучу күнү' : 'Subscription end date'}</small>
                  </div>
                  <Link to="/pricing" className="btn btn-secondary full-width">{t.subscription.changePlan}</Link>
                  <div className="profile-meta-card">
                    <span>{language === 'ru' ? 'Дата регистрации' : language === 'kg' ? 'Катталуу күнү' : 'Joined'}</span>
                    <strong>{joinedAt}</strong>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="profile-grid settings-main-grid">
                <div className="profile-info-block security-panel">
                  <h3>{language === 'ru' ? 'Безопасность' : language === 'kg' ? 'Коопсуздук' : 'Security'}</h3>
                  <form className="settings-form" onSubmit={async (event) => {
                    event.preventDefault()
                    if (isChangingPassword) return
                    setIsChangingPassword(true)
                    setPasswordNotice(null)
                    const result = await onChangePassword?.(currentPassword, newPassword, confirmPassword)
                    setIsChangingPassword(false)
                    setPasswordNotice(result?.message ?? null)
                    if (result?.ok) {
                      setCurrentPassword('')
                      setNewPassword('')
                      setConfirmPassword('')
                    }
                  }}>
                    <label>
                      <span>{language === 'ru' ? 'Текущий пароль' : language === 'kg' ? 'Учурдагы сырсөз' : 'Current password'}</span>
                      <PasswordInput compact value={currentPassword} onChange={setCurrentPassword} showLabel={t.auth.show} hideLabel={t.auth.hide} autoComplete="current-password" />
                    </label>
                    <label>
                      <span>{language === 'ru' ? 'Новый пароль' : language === 'kg' ? 'Жаңы сырсөз' : 'New password'}</span>
                      <PasswordInput compact value={newPassword} onChange={setNewPassword} showLabel={t.auth.show} hideLabel={t.auth.hide} autoComplete="new-password" />
                    </label>
                    <label>
                      <span>{language === 'ru' ? 'Подтвердите новый пароль' : language === 'kg' ? 'Жаңы сырсөздү ырастаңыз' : 'Confirm new password'}</span>
                      <PasswordInput compact value={confirmPassword} onChange={setConfirmPassword} showLabel={t.auth.show} hideLabel={t.auth.hide} autoComplete="new-password" />
                    </label>
                    <div className="field-hint">
                      <span>{language === 'ru' ? 'Минимум 8 символов' : language === 'kg' ? 'Минимум 8 белги' : 'Minimum 8 characters'}</span>
                    </div>
                    <button type="submit" className="btn btn-primary small full-width" disabled={isChangingPassword}>{isChangingPassword ? t.generic.loading : language === 'ru' ? 'Изменить пароль' : language === 'kg' ? 'Сырсөздү өзгөртүү' : 'Change password'}</button>
                    <Notification message={passwordNotice} inline />
                  </form>
                </div>
                <div className="profile-info-block">
                  <h3>{language === 'ru' ? 'Советы по безопасности' : language === 'kg' ? 'Коопсуздуктун кеңештери' : 'Security tips'}</h3>
                  <ul className="check-list compact-list">
                    <li><Check size={14} /> {language === 'ru' ? 'Используйте уникальный пароль для LEVEL UP' : language === 'kg' ? 'LEVEL UP үчүн өзүнчө сырсөз колдонуңуз' : 'Use a unique password for LEVEL UP'}</li>
                    <li><Check size={14} /> {language === 'ru' ? 'Не делитесь данными входа' : language === 'kg' ? 'Кирүү маалыматын бөлүшпеңиз' : 'Do not share your login details'}</li>
                    <li><Check size={14} /> {language === 'ru' ? 'Обновляйте пароль при необходимости' : language === 'kg' ? 'Сырсөздү мезгил-мезгили менен жаңыртып туруңуз' : 'Update your password regularly'}</li>
                  </ul>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="profile-grid settings-main-grid">
                <div className="profile-info-block">
                  <h3>{language === 'ru' ? 'Электронные уведомления' : language === 'kg' ? 'Электрондук эскертүүлөр' : 'Notifications'}</h3>
                  <form className="settings-form" onSubmit={(event) => {
                    event.preventDefault()
                    const result = onUpdateNotifications?.(notifSettings)
                    setNotificationNotice(result?.message ?? null)
                  }}>
                    <div className="toggle-list">
                      <div className="toggle-row">
                        <div>
                          <strong>{language === 'ru' ? 'Email-уведомления' : language === 'kg' ? 'Email эскертүүлөр' : 'Email notifications'}</strong>
                          <small>{language === 'ru' ? 'Получать новости и важные уведомления на почту' : language === 'kg' ? 'Жаңылыктарды жана маанилүү билдирүүлөрдү электрондук почтага алуу' : 'Receive updates and important notifications by email'}</small>
                        </div>
                        <button type="button" className={notifSettings.emailNotifications ? 'toggle active' : 'toggle'} onClick={() => setNotifSettings((current) => ({ ...current, emailNotifications: !current.emailNotifications }))} aria-label="Toggle email notifications">
                          <span />
                        </button>
                      </div>

                      <div className="toggle-row">
                        <div>
                          <strong>{language === 'ru' ? 'Уведомления о новых курсах' : language === 'kg' ? 'Жаңы курстар жөнүндө эскертүүлөр' : 'New course notifications'}</strong>
                          <small>{language === 'ru' ? 'Получать уведомления о новых курсах' : language === 'kg' ? 'Жаңы курстар жөнүндө эскертүүлөрдү алуу' : 'Get alerts when new courses are added'}</small>
                        </div>
                        <button type="button" className={notifSettings.newCourses ? 'toggle active' : 'toggle'} onClick={() => setNotifSettings((current) => ({ ...current, newCourses: !current.newCourses }))} aria-label="Toggle new courses notifications">
                          <span />
                        </button>
                      </div>

                      <div className="toggle-row">
                        <div>
                          <strong>{language === 'ru' ? 'Уведомления о новых уроках' : language === 'kg' ? 'Жаңы сабактар жөнүндө эскертүүлөр' : 'New lessons notifications'}</strong>
                          <small>{language === 'ru' ? 'Напоминания о новых доступных уроках' : language === 'kg' ? 'Жаңы сабактар чыкканда эскертме алуу' : 'Receive updates when new lessons are available'}</small>
                        </div>
                        <button type="button" className={notifSettings.newLessons ? 'toggle active' : 'toggle'} onClick={() => setNotifSettings((current) => ({ ...current, newLessons: !current.newLessons }))} aria-label="Toggle new lessons notifications">
                          <span />
                        </button>
                      </div>

                      <div className="toggle-row">
                        <div>
                          <strong>{language === 'ru' ? 'Новости и обновления LevelUp' : language === 'kg' ? 'LevelUp жаңылыктары жана жаңартуулары' : 'LevelUp news and updates'}</strong>
                          <small>{language === 'ru' ? 'Будьте в курсе новостей платформы' : language === 'kg' ? 'Платформанын жаңылыктарынан кабардар болуңуз' : 'Stay informed about product updates and news'}</small>
                        </div>
                        <button type="button" className={notifSettings.newsUpdates ? 'toggle active' : 'toggle'} onClick={() => setNotifSettings((current) => ({ ...current, newsUpdates: !current.newsUpdates }))} aria-label="Toggle LevelUp news notifications">
                          <span />
                        </button>
                      </div>
                    </div>

                    <button type="submit" className="btn btn-primary small full-width">{language === 'ru' ? 'Сохранить настройки' : language === 'kg' ? 'Параметрлерди сактоо' : 'Save preferences'}</button>
                    <Notification message={notificationNotice} inline />
                  </form>
                </div>
                <div className="profile-info-block">
                  <h3>{language === 'ru' ? 'План уведомлений' : language === 'kg' ? 'Эскертүүлөр планы' : 'Notification plan'}</h3>
                  <ul className="check-list compact-list">
                    <li><Check size={14} /> {language === 'ru' ? 'Срочные обновления' : language === 'kg' ? 'Маанилүү жаңыртуулар' : 'Important updates'}</li>
                    <li><Check size={14} /> {language === 'ru' ? 'Новые уроки и курсы' : language === 'kg' ? 'Жаңы сабактар жана курстар' : 'New lessons and courses'}</li>
                    <li><Check size={14} /> {language === 'ru' ? 'Персональные рекомендации' : language === 'kg' ? 'Жеке сунуштар' : 'Personalized suggestions'}</li>
                  </ul>
                </div>
              </div>
            )}

            {activeTab === 'preferences' && (
              <ProfileSettings t={t} language={language} setLanguage={setLanguage} theme={theme} setTheme={setTheme} user={user} joinedAt={joinedAt} onChangePassword={() => setActiveTab('security')} onLogout={onLogout} />
            )}
          </section>
        </main>
      </div>
    </div>
  )
}

function RatingPage({ t, leaderboard, reviews, currentEmail }: { t: (typeof translations)[Lang]; leaderboard: LeaderboardEntry[]; reviews: Review[]; currentEmail?: string }) {
  const language = useLanguage()
  const location = useLocation()
  const average = reviews.length ? (reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length).toFixed(1) : '0.0'
  const [limit, setLimit] = useState<3 | 5 | 10>(10)
  const visibleRows = leaderboard.slice(0, limit)
  const podium = leaderboard.slice(0, 3)
  const myIndex = currentEmail ? leaderboard.findIndex((entry) => entry.email === currentEmail) : -1
  const fallbackPath = location.pathname.startsWith('/dashboard') ? '/dashboard' : '/home'

  return (
    <div className="container section page-block rating-page">
      <PageHero
        back={<SmartBackButton fallback={fallbackPath} label={pick(language, 'Кайтуу', 'Назад', 'Back')} />}
        eyebrow={pick(language, 'Лидерлер', 'Таблица лидеров', 'Leaderboard')}
        title={t.nav.rating}
        subtitle={pick(language, 'Сабактарды бүтүрүп, упай топтоп, лидерлердин катарына кириңиз.', 'Проходите уроки, набирайте баллы и попадайте в число лидеров.', 'Complete lessons, earn points and climb the leaderboard.')}
        aside={(
          <div className="rating-hero-stats">
            <div><span>{t.ratingsAvg}</span><strong>{average}</strong><StarRating value={Number(average)} size={16} /></div>
            <div><span>{pick(language, 'Катышуучулар', 'Участников', 'Participants')}</span><strong>{leaderboard.length}</strong></div>
            {myIndex >= 0 && <div className="mine"><span>{pick(language, 'Сиздин орун', 'Ваше место', 'Your place')}</span><strong>#{myIndex + 1}</strong></div>}
          </div>
        )}
      />

      {leaderboard.length === 0 ? (
        <EmptyState icon={Trophy}>{t.messages.emptyLeaderboard}</EmptyState>
      ) : (
        <>
          <div className="podium" aria-label="Top 3">
            {podium.map((person, index) => (
              <div key={person.id} className={['podium-place', `place-${index + 1}`, person.email === currentEmail ? 'is-me' : ''].filter(Boolean).join(' ')}>
                <span className="podium-medal">{index === 0 ? <Crown size={18} /> : <Award size={18} />} {index + 1}</span>
                <div className="avatar">{renderAvatarContent(person.avatar, person.name?.charAt(0)?.toUpperCase() || 'U')}</div>
                <strong>{person.name}</strong>
                <span className="podium-score">{person.score} {pick(language, 'упай', 'баллов', 'pts')}</span>
              </div>
            ))}
          </div>

          <div className="detail-card leaderboard-table-card">
            <div className="card-header-row">
              <h3><Trophy size={20} /> {pick(language, 'Лидерлер таблицасы', 'Таблица лидеров', 'Leaderboard')}</h3>
              <div className="segmented" role="group" aria-label={pick(language, 'Көрсөтүү', 'Показать', 'Show')}>
                {([3, 5, 10] as const).map((value) => (
                  <button key={value} type="button" className={limit === value ? 'active' : ''} aria-pressed={limit === value} onClick={() => setLimit(value)}>Top {value}</button>
                ))}
              </div>
            </div>
            <div className="leaderboard-list">
              {visibleRows.map((person, index) => {
                const isMe = person.email === currentEmail
                return (
                  <div className={isMe ? 'leader-row is-me' : 'leader-row'} key={person.id}>
                    <span className={index < 3 ? 'leader-rank top' : 'leader-rank'}>#{index + 1}</span>
                    <div className="avatar small">{renderAvatarContent(person.avatar, person.name?.charAt(0)?.toUpperCase() || 'U')}</div>
                    <div className="leader-info">
                      <strong>{person.name} {isMe && <Badge tone="green">{pick(language, 'Сиз', 'Вы', 'You')}</Badge>}</strong>
                      <span><GraduationCap size={14} /> {person.courses} {pick(language, 'курс бүттү', 'курсов пройдено', 'courses completed')}{person.achievements.length > 0 ? ` · ${person.achievements.length} ${pick(language, 'жетишкендик', 'достижений', 'achievements')}` : ''}</span>
                    </div>
                    <div className="score-block"><strong>{person.score}</strong><span>{pick(language, 'упай', 'баллов', 'pts')}</span></div>
                  </div>
                )
              })}
            </div>
            {myIndex >= limit && (
              <p className="leader-me-note">{pick(language, 'Сиздин орун', 'Ваше место', 'Your place')}: <strong>#{myIndex + 1}</strong> · {leaderboard[myIndex].score} {pick(language, 'упай', 'баллов', 'pts')}</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function ReviewsPage({ t, reviews, setReviews, isLoggedIn, user, onRefreshSiteStats }: { t: (typeof translations)[Lang]; reviews: Review[]; setReviews: React.Dispatch<React.SetStateAction<Review[]>>; isLoggedIn: boolean; user: UserProfile | null; onRefreshSiteStats?: () => Promise<void> | void }) {
  const { courses } = useCourseCatalog()
  const reviewLessonOptions = useMemo(() => buildReviewLessonOptions(courses), [courses])
  const [rating, setRating] = useState(5)
  const [text, setText] = useState('')
  const [lessonId, setLessonId] = useState(reviewLessonOptions[0]?.id ?? '')
  const [notice, setNotice] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // The server marks the logged-in viewer's own review with `isOwn` (emails are not public).
  const userReview = user ? reviews.find((item) => item.isOwn) : undefined
  const average = reviews.length ? (reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length).toFixed(1) : '0.0'

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!isLoggedIn || !user) {
      setNotice(t.messages.loginRequired)
      return
    }
    if (!text.trim()) {
      setNotice(language === 'ru' ? 'Введите текст отзыва' : language === 'kg' ? 'Пикир жазыңыз' : 'Enter review text')
      return
    }
    if (!lessonId) {
      setNotice(language === 'ru' ? 'Выберите урок' : language === 'kg' ? 'Сабак тандаңыз' : 'Select lesson')
      return
    }

    // The selected id can be stale if the course catalog was refreshed from the server.
    const selectedLesson = reviewLessonOptions.find((item) => item.id === lessonId) ?? reviewLessonOptions[0]
    if (!selectedLesson) return

    setIsSubmitting(true)
    let result: { created?: boolean; updated?: boolean }
    try {
      result = await saveReviewToServer({
        lessonId: selectedLesson.id,
        lessonLabel: selectedLesson.label,
        rating,
        text: text.trim()
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setNotice(message)
      setIsSubmitting(false)
      return
    }

    // Reload from the server (source of truth) so the list, the user's own review
    // and the average rating are always consistent, even across devices.
    try {
      setReviews(await getReviewsFromServer())
    } catch (error) {
      console.error('Failed to refresh reviews after saving:', error)
    }
    void onRefreshSiteStats?.()
    setText('')
    setRating(5)
    setIsSubmitting(false)
    setNotice(result.updated
      ? (language === 'ru' ? 'Отзыв обновлён' : language === 'kg' ? 'Пикир жаңыртылды' : 'Review updated')
      : (language === 'ru' ? 'Отзыв сохранён' : language === 'kg' ? 'Пикир сакталды' : 'Review saved'))
  }

  const language = useLanguage()

  const location = useLocation()
  const fallbackPath = location.pathname.startsWith('/dashboard') ? '/dashboard' : '/home'
  const selectedCourse = courses.find((course) => course.lessons.some((lesson) => lesson.id === lessonId)) ?? courses[0]
  const ratingCounts = [5, 4, 3, 2, 1].map((value) => ({ value, count: reviews.filter((item) => item.rating === value).length }))

  return (
    <div className="container section page-block reviews-page">
      <PageHero
        back={<SmartBackButton fallback={fallbackPath} label={pick(language, 'Кайтуу', 'Назад', 'Back')} />}
        eyebrow={pick(language, 'Студенттердин пикирлери', 'Отзывы студентов', 'Student reviews')}
        title={t.nav.reviews}
        subtitle={pick(language, 'Окуучулар LevelUp курстары жөнүндө эмне дешет.', 'Что говорят ученики о курсах LevelUp.', 'What learners say about LevelUp courses.')}
        aside={(
          <div className="ui-hero-chips">
            <span><MessageSquareText size={16} /> {reviews.length} {pick(language, 'пикир', 'отзывов', 'reviews')}</span>
          </div>
        )}
      />
      <div className="rating-grid">
        <div className="stat-banner review-banner">
          <p>{t.ratingsAvg}</p>
          <h2>{average}</h2>
          <StarRating value={Number(average)} size={22} />
          <div className="rating-breakdown">
            {ratingCounts.map(({ value, count }) => (
              <div key={value} className="rating-breakdown-row">
                <span>{value} <Star size={12} fill="currentColor" /></span>
                <div className="progress-bar"><span style={{ width: `${reviews.length ? Math.round((count / reviews.length) * 100) : 0}%` }} /></div>
                <small>{count}</small>
              </div>
            ))}
          </div>
        </div>
        <form className="review-form" onSubmit={handleSubmit}>
          <h3>{userReview ? pick(language, 'Пикириңизди өзгөртүү', 'Изменить ваш отзыв', 'Edit your review') : t.sections.leaveReview}</h3>
          {!isLoggedIn && (
            <p className="review-login-note"><Lock size={15} /> {t.messages.loginRequired} <Link to={`/auth?mode=login&next=${encodeURIComponent(location.pathname)}`}>{t.auth.login}</Link></p>
          )}
          <StarRating value={rating} onChange={setRating} size={26} label={pick(language, 'Баа', 'Оценка', 'Rating')} />
          <div className="two-column-fields">
            <label>
              <span>{pick(language, 'Курс', 'Курс', 'Course')}</span>
              <select value={selectedCourse?.id ?? ''} onChange={(event) => {
                const nextCourse = courses.find((course) => course.id === event.target.value)
                if (nextCourse?.lessons[0]) setLessonId(nextCourse.lessons[0].id)
              }}>
                {courses.map((course) => <option key={course.id} value={course.id}>{course.title[language]}</option>)}
              </select>
            </label>
            <label>
              <span>{pick(language, 'Сабак', 'Урок', 'Lesson')}</span>
              <select value={lessonId} onChange={(event) => setLessonId(event.target.value)}>
                {(selectedCourse?.lessons ?? []).map((lesson, index) => (
                  <option key={lesson.id} value={lesson.id}>{index + 1}. {lesson.title[language]}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            <span>{pick(language, 'Пикир', 'Ваш отзыв', 'Your review')}</span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t.sections.leaveReview} maxLength={2000} />
          </label>
          <button type="submit" className="btn btn-primary full-width" disabled={isSubmitting}>
            <SendHorizonal size={16} /> {isSubmitting ? t.generic.loading : userReview ? pick(language, 'Пикирди жаңыртуу', 'Обновить отзыв', 'Update review') : t.buttons.send}
          </button>
          <small className="field-hint-inline">{pick(language, 'Пикирлер жарыяланганга чейин модерациядан өтөт.', 'Отзывы проходят модерацию перед публикацией.', 'Reviews are moderated before publishing.')}</small>
          <Notification message={notice} inline />
        </form>
      </div>
      {reviews.length === 0 ? (
        <EmptyState icon={MessageSquareText}>{t.messages.emptyReviews}</EmptyState>
      ) : (
        <div className="reviews-grid">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} language={language} onEdit={user && review.isOwn ? () => { setText(review.text); setRating(review.rating); if (review.lessonId) setLessonId(review.lessonId) } : undefined} />
          ))}
        </div>
      )}
    </div>
  )
}

function PricingPage({ t }: { t: (typeof translations)[Lang] }) {
  const language = useLanguage()
  const location = useLocation()
  const { plans, subscription, isLoggedIn } = useBilling()
  const fallbackPath = location.pathname.startsWith('/dashboard') ? '/dashboard' : '/'
  const current = accessPlanOf(subscription)

  return (
    <div className="container section page-block pricing-page">
      <PageHero
        back={<SmartBackButton fallback={fallbackPath} label={pick(language, 'Кайтуу', 'Назад', 'Back')} />}
        eyebrow={pick(language, 'Тарифтер', 'Тарифы', 'Plans')}
        title={t.pricingTitle}
        subtitle={pick(language, 'Акысыз баштаңыз жана каалаган убакта PRO же AI Pro тарифине өтүңүз.', 'Начните бесплатно и переходите на PRO или AI Pro в любой момент.', 'Start free and upgrade to PRO or AI Pro at any time.')}
      />
      {isLoggedIn && subscription.synced && (
        <div className="current-plan-banner" role="status">
          <BadgeCheck size={20} />
          <span>
            {pick(language, 'Сиздин тариф', 'Ваш тариф', 'Your plan')}: <strong>{PLAN_META[current].name}</strong>
            {current !== 'free' && subscription.endsAt ? <> · {pick(language, 'чейин', 'до', 'until')} {formatDateTime(subscription.endsAt, language)}</> : null}
            {subscription.rawStatus === 'cancelled' ? <> · {subscriptionStatusText(subscription, language)}</> : null}
          </span>
          <Link to="/dashboard" className="text-link">{pick(language, 'Тарифимди көрүү', 'Мой тариф', 'View my plan')}</Link>
        </div>
      )}
      <div className="pricing-grid big-grid">
        {plans.map((plan) => <PricingCard key={plan.id} plan={plan} t={t} language={language} />)}
      </div>
      <PlanComparison plans={plans} />
      <p className="pricing-note"><ShieldCheck size={16} /> {pick(language, 'Төлөм MBank, O!Деньги же Элсом аркылуу. Тариф төлөм ырасталгандан кийин гана активдешет.', 'Оплата через MBank, O!Деньги или Элсом. Тариф активируется только после подтверждения оплаты.', 'Pay with MBank, O!Dengi or Elsom. A plan is activated only after the payment is confirmed.')}</p>
    </div>
  )
}

type CheckoutPhase = 'review' | 'creating' | 'redirecting' | 'checking' | 'pending' | 'paid' | 'failed' | 'cancelled'

function CheckoutPage({ t, user }: { t: (typeof translations)[Lang]; user: UserProfile | null }) {
  const { planId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const language = useLanguage()
  const { plans, subscription, refreshSubscription } = useBilling()
  const plan = plans.find((item) => item.id === planId) ?? null
  const fallbackPath = location.pathname.startsWith('/dashboard') ? '/dashboard/pricing' : '/pricing'
  const [method, setMethod] = useState<PaymentMethod>('MBank')
  const [confirmed, setConfirmed] = useState(false)
  const [phase, setPhase] = useState<CheckoutPhase>('review')
  const [orderId, setOrderId] = useState<string | null>(() => searchParams.get('orderId'))
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef(0)
  // Purchase form. Card = Demo Payment window (card data stays in the browser, nothing is charged).
  // A bank transfer needs only payer name + reference.
  const [payMode, setPayMode] = useState<'card' | 'online' | 'bank'>('card')
  const demoEnabled = useDemoPaymentEnabled()
  const [demoOpen, setDemoOpen] = useState(false)
  const [fullName, setFullName] = useState(user?.name ?? '')
  const [payerName, setPayerName] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [receiptNote, setReceiptNote] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [manualConfig, setManualConfig] = useState<ManualTransferConfig | null>(null)
  const [orderProvider, setOrderProvider] = useState<string | null>(null)
  const [reviewNote, setReviewNote] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getManualTransferConfig().then((cfg) => { if (active) setManualConfig(cfg) }).catch(() => { if (active) setManualConfig({ enabled: false }) })
    return () => { active = false }
  }, [])
  const effectivePayMode = payMode === 'card' && demoEnabled === false ? 'online' : payMode

  const current = accessPlanOf(subscription)
  const kind: 'new' | 'renewal' | 'upgrade' | 'included' = !plan || plan.id === 'free'
    ? 'included'
    : current === plan.id ? 'renewal' : PLAN_RANK[plan.id] < PLAN_RANK[current] ? 'included' : current === 'free' ? 'new' : 'upgrade'
  const currency = plan?.currency === 'KGS' ? 'сом' : plan?.currency ?? ''
  const newEndDate = plan
    ? new Date((kind === 'renewal' && subscription.endsAt ? new Date(subscription.endsAt).getTime() : Date.now()) + plan.durationDays * 24 * 60 * 60 * 1000).toISOString()
    : null

  const errorText = (err: unknown) => {
    if (err instanceof ApiError) {
      if (err.code === 'PAYMENT_NOT_CONFIGURED') return pick(language, 'Онлайн-төлөм азырынча туташтырыла элек. Кийинчерээк кайра аракет кылыңыз же колдоо кызматына жазыңыз.', 'Онлайн-оплата пока не подключена. Попробуйте позже или напишите в поддержку.', 'Online payment is not connected yet. Please try again later or contact support.')
      if (err.code === 'PLAN_INCLUDED') return pick(language, 'Бул тариф учурдагы тарифиңизге кирет.', 'Этот тариф уже входит в ваш текущий тариф.', 'This plan is already included in your current plan.')
      if (err.code === 'PLAN_DISABLED') return pick(language, 'Бул тариф азыр жеткиликсиз.', 'Этот тариф сейчас недоступен.', 'This plan is not available right now.')
      if (err.code === 'PROVIDER_ERROR') return pick(language, 'Төлөм системасы жооп бербей жатат. Бир аздан кийин кайра аракет кылыңыз.', 'Платёжная система не отвечает. Попробуйте чуть позже.', 'The payment system is not responding. Please try again shortly.')
      if (err.code === 'MISSING_FIELDS') return pick(language, 'Бардык милдеттүү талааларды толтуруңуз.', 'Заполните все обязательные поля.', 'Please fill in all required fields.')
      if (err.code === 'INVALID_EMAIL' || err.code === 'EMAIL_MISMATCH') return pick(language, 'Email туура эмес же аккаунтуңузга дал келбейт.', 'Неверный email или он не совпадает с вашим аккаунтом.', 'The email is invalid or does not match your account.')
      if (err.code === 'INVALID_REFERENCE') return pick(language, 'Төлөмдүн номери туура эмес (4–64 белги: тамгалар, сандар, «-»).', 'Неверный номер платежа (4–64 символа: буквы, цифры, «-»).', 'Invalid payment reference (4–64 characters: letters, digits, "-").')
      if (err.code === 'CARD_DATA_REJECTED') return pick(language, 'Карта номерин жазбаңыз — банктагы төлөмдүн номерин гана көрсөтүңүз.', 'Не вводите номер карты — укажите только номер платежа из банка.', 'Do not enter a card number — use the bank transaction reference only.')
      if (err.code === 'DUPLICATE_REFERENCE') return pick(language, 'Бул төлөм номери мурун эле жөнөтүлгөн.', 'Этот номер платежа уже был отправлен.', 'This payment reference has already been submitted.')
      if (err.code === 'MANUAL_PENDING_EXISTS') return pick(language, 'Сизде текшерүүнү күтүп жаткан которуу бар. Администратордун жообун күтүңүз.', 'У вас уже есть перевод, ожидающий проверки. Дождитесь решения администратора.', 'You already have a transfer awaiting review. Please wait for the administrator.')
      if (err.code === 'INVALID_EXPIRY') return pick(language, 'Картанын мөөнөтү туура эмес же өтүп кеткен.', 'Неверный или истёкший срок действия карты.', 'The card expiry date is invalid or in the past.')
      if (err.code === 'DUPLICATE_SUBMIT') return pick(language, 'Төлөм жаңы эле жөнөтүлдү. Жеке кабинетти текшериңиз.', 'Оплата только что отправлена. Проверьте личный кабинет.', 'The payment was just submitted. Please check your dashboard.')
      if (err.code === 'DEMO_DISABLED') return pick(language, 'Карта менен төлөө азыр өчүрүлгөн.', 'Оплата картой сейчас отключена.', 'Card payment is turned off right now.')
      if (err.code === 'MANUAL_NOT_CONFIGURED') return pick(language, 'Банктык которуу азыр жеткиликсиз.', 'Банковский перевод сейчас недоступен.', 'Bank transfer is not available right now.')
      if (err.status === 401) return pick(language, 'Сессия бүттү. Кайра кириңиз.', 'Сессия истекла. Войдите снова.', 'Your session has expired. Please log in again.')
      return err.message
    }
    if (isNetworkError(err)) return pick(language, 'Сервер азыр жооп бербей жатат. Бир мүнөттөн кийин кайра аракет кылыңыз.', 'Сервер сейчас не отвечает. Попробуйте через минуту.', 'The server is not responding. Please try again in a minute.')
    return err instanceof Error ? err.message : String(err)
  }

  const checkStatus = useCallback(async (id: string) => {
    setPhase('checking')
    setError(null)
    try {
      const order = await getPaymentOrderStatus(id)
      setOrderProvider(order.provider ?? null)
      setReviewNote(order.reviewNote ?? null)
      if (order.status === 'paid' && order.activated) {
        await refreshSubscription()
        setPhase('paid')
        return 'done'
      }
      if (order.status === 'failed') { setPhase('failed'); return 'done' }
      if (order.status === 'cancelled') { setPhase('cancelled'); return 'done' }
      setPhase('pending')
      return 'pending'
    } catch (err) {
      setError(errorText(err))
      setPhase('pending')
      return 'pending'
    }
    // errorText only depends on the language
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSubscription, language])

  // Returning from the payment page: poll the server (the provider's webhook activates the plan).
  useEffect(() => {
    if (!orderId || !user) return
    let stopped = false
    pollRef.current = 0
    const tick = async () => {
      if (stopped) return
      const result = await checkStatus(orderId)
      pollRef.current += 1
      // Online payments confirm within minutes; a bank transfer waits for the administrator, so poll slower.
      if (result === 'pending' && pollRef.current < 40 && !stopped) window.setTimeout(() => { void tick() }, pollRef.current > 10 ? 15000 : 3000)
    }
    void tick()
    return () => { stopped = true }
  }, [orderId, user, checkStatus])

  const validateForm = () => {
    const errors: Record<string, string> = {}
    const required = pick(language, 'Милдеттүү талаа', 'Обязательное поле', 'Required field')
    if (fullName.trim().length < 2) errors.fullName = required
    if (!user?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) errors.email = pick(language, 'Email туура эмес', 'Неверный email', 'Invalid email')
    if (effectivePayMode === 'bank') {
      if (payerName.trim().length < 2) errors.payerName = required
      if (!paymentReference.trim()) errors.paymentReference = required
      else if (!/^[A-Za-z0-9][A-Za-z0-9\-_/.# ]{3,63}$/.test(paymentReference.trim())) errors.paymentReference = pick(language, '4–64 белги: тамгалар, сандар, «-»', '4–64 символа: буквы, цифры, «-»', '4–64 characters: letters, digits, "-"')
      else if (/(?:\d[ -]?){13,19}/.test(paymentReference)) errors.paymentReference = pick(language, 'Карта номерин жазбаңыз', 'Не вводите номер карты', 'Do not enter a card number')
    }
    if (!confirmed) errors.confirm = pick(language, 'Сатып алууну ырастаңыз', 'Подтвердите покупку', 'Please confirm the purchase')
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const submitPurchase = async (event?: React.FormEvent) => {
    event?.preventDefault()
    if (!user || !plan || kind === 'included') return
    setError(null)
    // Card payment happens in the Demo Payment window (it validates its own fields).
    if (effectivePayMode === 'card') {
      setFieldErrors({})
      setDemoOpen(true)
      return
    }
    if (!validateForm()) {
      setError(pick(language, 'Маалымат толук эмес — белгиленген талааларды текшериңиз.', 'Не хватает данных — проверьте отмеченные поля.', 'Some information is missing — check the highlighted fields.'))
      return
    }
    setPhase('creating')
    try {
      if (effectivePayMode === 'bank') {
        const created = await submitManualTransfer({ planId: plan.id, fullName: fullName.trim(), email: user.email, payerName: payerName.trim(), paymentReference: paymentReference.trim(), receiptNote: receiptNote.trim() || undefined })
        setOrderProvider('manual')
        setOrderId(created.orderId)
        setPhase('pending')
        void refreshSubscription()
        return
      }
      const created = await createPaymentOrder({ userEmail: user.email, userName: fullName.trim() || user.name, planId: plan.id, paymentMethod: method })
      setOrderId(created.orderId)
      setPhase('redirecting')
      window.location.assign(created.paymentUrl)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'DUPLICATE_REFERENCE') setFieldErrors({ paymentReference: errorText(err) })
      setError(errorText(err))
      setPhase('review')
    }
  }

  if (!plan || plan.id === 'free') {
    return (
      <div className="container section page-block checkout-page">
        <PageHero back={<SmartBackButton fallback={fallbackPath} label={pick(language, 'Кайтуу', 'Назад', 'Back')} />} eyebrow={pick(language, 'Төлөм', 'Оплата', 'Checkout')} title={pick(language, 'Тариф табылган жок', 'Тариф не найден', 'Plan not found')} subtitle={pick(language, 'Бул тариф жок же азыр жеткиликсиз.', 'Такого тарифа нет или он сейчас недоступен.', 'This plan does not exist or is not available right now.')} actions={<ButtonLink to={fallbackPath} icon={ArrowLeft}>{pick(language, 'Тарифтерге', 'К тарифам', 'To plans')}</ButtonLink>} />
      </div>
    )
  }

  const methods: Array<{ id: PaymentMethod; label: string }> = [
    { id: 'MBank', label: 'MBank' },
    { id: 'O!Деньги', label: 'O!Деньги' },
    { id: 'Элсом', label: 'Элсом' }
  ]
  const pendingForThisPlan = subscription.pendingOrder && subscription.pendingOrder.planId === plan.id && !orderId ? subscription.pendingOrder : null

  return (
    <div className="container section page-block checkout-page">
      <PageHero
        back={<SmartBackButton fallback={fallbackPath} label={pick(language, 'Кайтуу', 'Назад', 'Back')} />}
        eyebrow={pick(language, 'Төлөм', 'Оформление', 'Checkout')}
        title={`${plan.name} — ${plan.label[language]}`}
        subtitle={plan.description[language]}
      />

      <div className="checkout-layout">
        <section className="ui-card checkout-summary" aria-label={pick(language, 'Буйрутма', 'Заказ', 'Order')}>
          <h2>{pick(language, 'Буйрутма', 'Ваш заказ', 'Your order')}</h2>
          <dl className="checkout-lines">
            <div><dt>{pick(language, 'Тариф', 'Тариф', 'Plan')}</dt><dd>{plan.name}</dd></div>
            <div><dt>{pick(language, 'Мөөнөт', 'Срок', 'Period')}</dt><dd>{pick(language, `${plan.durationDays} күн`, `${plan.durationDays} дней`, `${plan.durationDays} days`)}</dd></div>
            <div><dt>{pick(language, 'Учурдагы тариф', 'Текущий тариф', 'Current plan')}</dt><dd>{PLAN_META[current].name}</dd></div>
            <div><dt>{pick(language, 'Жаңы бүтүү күнү', 'Новая дата окончания', 'New end date')}</dt><dd>{kind === 'included' ? '—' : formatDateTime(newEndDate, language)}</dd></div>
            <div className="checkout-total"><dt>{pick(language, 'Төлөөгө', 'К оплате', 'Total')}</dt><dd>{plan.price} {currency}</dd></div>
          </dl>
          <p className="checkout-kind">
            {kind === 'renewal' && pick(language, `Учурдагы ${plan.name} тарифиңизге ${plan.durationDays} күн кошулат.`, `К текущему тарифу ${plan.name} добавятся ${plan.durationDays} дней.`, `${plan.durationDays} days will be added to your current ${plan.name} plan.`)}
            {kind === 'upgrade' && pick(language, `${plan.name} төлөм ырасталгандан кийин дароо башталат жана учурдагы ${PLAN_META[current].name} тарифин алмаштырат.`, `${plan.name} начнёт действовать сразу после подтверждения оплаты и заменит текущий ${PLAN_META[current].name}.`, `${plan.name} starts as soon as the payment is confirmed and replaces your current ${PLAN_META[current].name}.`)}
            {kind === 'new' && pick(language, 'Тариф төлөм ырасталгандан кийин гана активдешет.', 'Тариф активируется только после подтверждения оплаты.', 'The plan is activated only after the payment is confirmed.')}
            {kind === 'included' && pick(language, 'Бул тариф учурдагы тарифиңизге кирет — сатып алуунун кереги жок.', 'Этот тариф уже входит в ваш текущий — покупать не нужно.', 'This plan is already included in your current plan — no need to buy it.')}
          </p>
        </section>

        <section className="ui-card checkout-pay" aria-label={pick(language, 'Төлөм', 'Оплата', 'Payment')}>
          {phase === 'paid' ? (
            <div className="checkout-result success" role="status">
              <CheckCircle2 size={36} />
              <h2>{pick(language, 'Төлөм ырасталды', 'Оплата подтверждена', 'Payment confirmed')}</h2>
              <p>{pick(language, `${plan.name} тарифи активдүү`, `Тариф ${plan.name} активен`, `${plan.name} is active`)} · {pick(language, 'чейин', 'до', 'until')} {formatDateTime(subscription.endsAt, language)}</p>
              <div className="checkout-result-actions">
                <ButtonLink to="/dashboard" icon={LayoutDashboard}>{pick(language, 'Жеке кабинет', 'Личный кабинет', 'Dashboard')}</ButtonLink>
                {plan.id === 'aipro' && <ButtonLink to="/dashboard/ai" variant="secondary" icon={Bot}>AI Assistant</ButtonLink>}
              </div>
            </div>
          ) : phase === 'failed' || phase === 'cancelled' ? (
            <div className="checkout-result error" role="alert">
              <X size={36} />
              <h2>{phase === 'failed' ? pick(language, 'Төлөм өтпөй калды', 'Оплата не прошла', 'Payment failed') : pick(language, 'Төлөм жокко чыгарылды', 'Оплата отменена', 'Payment cancelled')}</h2>
              {orderProvider === 'manual'
                ? <p>{pick(language, 'Администратор которууну ырастаган жок, тариф өзгөргөн жок.', 'Администратор не подтвердил перевод, тариф не изменился.', 'The administrator did not confirm the transfer; your plan did not change.')}{reviewNote ? ` ${pick(language, 'Себеби', 'Причина', 'Reason')}: ${reviewNote}` : ''}</p>
                : <p>{pick(language, 'Акча алынган жок, тариф өзгөргөн жок. Кайра аракет кылсаңыз болот.', 'Деньги не списаны, тариф не изменился. Можно попробовать ещё раз.', 'No money was taken and your plan did not change. You can try again.')}</p>}
              <Button icon={RefreshCw} onClick={() => { setOrderId(null); setPhase('review'); navigate(location.pathname, { replace: true }) }}>{pick(language, 'Кайра аракет кылуу', 'Попробовать снова', 'Try again')}</Button>
            </div>
          ) : orderId && (phase === 'pending' || phase === 'checking') ? (
            <div className="checkout-result pending" role="status" aria-live="polite">
              <Clock3 size={36} />
              {orderProvider === 'manual' ? (
                <>
                  <h2>{pick(language, 'Өтүнмө жөнөтүлдү — текшерүү күтүлүүдө', 'Заявка отправлена — ожидает проверки', 'Request sent — awaiting review')}</h2>
                  <p>{pick(language, 'Статус: PENDING. Администратор которууну текшергенден кийин тариф активдешет. Бул баракты жаап, кийинчерээк жеке кабинеттен текшерсеңиз болот.', 'Статус: PENDING. Тариф активируется после того, как администратор проверит перевод. Можно закрыть страницу и проверить позже в личном кабинете.', 'Status: PENDING. The plan activates after the administrator verifies the transfer. You can close this page and check later in your dashboard.')}</p>
                </>
              ) : (
                <>
                  <h2>{pick(language, 'Төлөм күтүлүүдө', 'Ожидаем подтверждение оплаты', 'Waiting for payment confirmation')}</h2>
                  <p>{pick(language, 'Төлөм системасы төлөмдү ырастаганда тариф өзү активдешет. Бул баракта статус автоматтык түрдө жаңыланат.', 'Тариф активируется автоматически, когда платёжная система подтвердит оплату. Статус на этой странице обновляется сам.', 'The plan activates automatically once the payment system confirms the payment. This page updates by itself.')}</p>
                </>
              )}
              <Button variant="secondary" icon={RefreshCw} disabled={phase === 'checking'} onClick={() => { void checkStatus(orderId) }}>{phase === 'checking' ? pick(language, 'Текшерилүүдө...', 'Проверяем...', 'Checking...') : pick(language, 'Статусту текшерүү', 'Проверить статус', 'Check status')}</Button>
              <Notification message={error} tone="error" />
            </div>
          ) : (
            <form className="checkout-form" noValidate onSubmit={(event) => { void submitPurchase(event) }}>
              <h2>{pick(language, 'Сатып алуучунун маалыматы', 'Данные покупателя', 'Customer information')}</h2>
              <div className="checkout-fields">
                <label className={fieldErrors.fullName ? 'checkout-field has-error' : 'checkout-field'}>
                  <span>{pick(language, 'Толук аты-жөнү', 'ФИО', 'Full name')} *</span>
                  <input type="text" autoComplete="name" maxLength={120} value={fullName} onChange={(event) => setFullName(event.target.value)} aria-invalid={!!fieldErrors.fullName} />
                  {fieldErrors.fullName && <small className="field-error">{fieldErrors.fullName}</small>}
                </label>
                <label className={fieldErrors.email ? 'checkout-field has-error' : 'checkout-field'}>
                  <span>Email</span>
                  <input type="email" value={user?.email ?? ''} readOnly aria-readonly="true" aria-invalid={!!fieldErrors.email} />
                  {fieldErrors.email && <small className="field-error">{fieldErrors.email}</small>}
                </label>
              </div>

              <h2>{pick(language, 'Төлөм ыкмасы', 'Способ оплаты', 'Payment method')}</h2>
              <div className="payment-mode-switch" role="radiogroup" aria-label={pick(language, 'Төлөм түрү', 'Тип оплаты', 'Payment type')}>
                {demoEnabled ? (
                  <button type="button" role="radio" aria-checked={effectivePayMode === 'card'} className={effectivePayMode === 'card' ? 'payment-method active' : 'payment-method'} onClick={() => setPayMode('card')} disabled={kind === 'included'}>
                    <CreditCard size={20} /><span>{pick(language, 'Банк картасы', 'Банковская карта', 'Bank card')}</span>
                  </button>
                ) : (
                  <button type="button" role="radio" aria-checked={effectivePayMode === 'online'} className={effectivePayMode === 'online' ? 'payment-method active' : 'payment-method'} onClick={() => setPayMode('online')} disabled={kind === 'included'}>
                    <WalletCards size={20} /><span>{pick(language, 'Онлайн-төлөм', 'Онлайн-оплата', 'Online payment')}</span>
                  </button>
                )}
                {manualConfig?.enabled && (
                  <button type="button" role="radio" aria-checked={effectivePayMode === 'bank'} className={effectivePayMode === 'bank' ? 'payment-method active' : 'payment-method'} onClick={() => setPayMode('bank')} disabled={kind === 'included'}>
                    <Building2 size={20} /><span>{pick(language, 'Банктык которуу', 'Банковский перевод', 'Bank transfer')}</span>
                  </button>
                )}
              </div>
              {pendingForThisPlan && (
                <div className="checkout-pending-note" role="status">
                  <Clock3 size={18} />
                  <span>{pendingForThisPlan.provider === 'manual'
                    ? pick(language, 'Бул тариф үчүн которууңуз текшерүүдө.', 'Ваш перевод за этот тариф ожидает проверки.', 'Your transfer for this plan is awaiting review.')
                    : pick(language, 'Бул тариф үчүн бүтпөгөн төлөм бар.', 'У вас есть незавершённая оплата этого тарифа.', 'You have an unfinished payment for this plan.')}</span>
                  <button type="button" className="text-button" onClick={() => setOrderId(pendingForThisPlan.orderId)}>{pick(language, 'Статусту текшерүү', 'Проверить статус', 'Check status')}</button>
                </div>
              )}
              {effectivePayMode === 'card' ? (
                <>
                  <p className="checkout-demo-note">{pick(language, 'Демо-төлөм: «Төлөө» баскычы карта формасын ачат. Акча алынбайт, тариф дароо активдешет.', 'Демо-оплата: кнопка «Оплатить» откроет форму карты. Деньги не списываются, тариф активируется сразу.', 'Demo payment: "Pay" opens the card form. No money is charged; the plan activates immediately.')}</p>
                  {(plan.id === 'pro' || plan.id === 'aipro') && (
                    <PaymentModal
                      open={demoOpen}
                      onClose={(paid) => { setDemoOpen(false); if (paid) setPhase('paid') }}
                      plan={{ id: plan.id, name: plan.name, title: plan.label[language], price: plan.price, currency: plan.currency, durationDays: plan.durationDays }}
                      language={language}
                      onPaid={async () => { const fresh = await refreshSubscription(); return fresh ? accessPlanOf(fresh) : null }}
                      endsAtText={(iso) => formatDateTime(iso, language)}
                    />
                  )}
                </>
              ) : effectivePayMode === 'online' ? (
                <>
                  <p className="checkout-subtitle">{pick(language, 'Төлөм системасын тандаңыз', 'Выберите платёжную систему', 'Choose a payment provider')}</p>
                  <div className="payment-methods" role="radiogroup" aria-label={pick(language, 'Төлөм системасы', 'Платёжная система', 'Payment provider')}>
                    {methods.map((item) => (
                      <button key={item.id} type="button" role="radio" aria-checked={method === item.id} className={method === item.id ? 'payment-method active' : 'payment-method'} onClick={() => setMethod(item.id)} disabled={kind === 'included'}>
                        <WalletCards size={20} /><span>{item.label}</span>{method === item.id && <CheckCircle2 size={18} />}
                      </button>
                    ))}
                  </div>
                </>
              ) : manualConfig?.enabled && (
                <>
                  <div className="bank-details" aria-label={pick(language, 'Которуу үчүн реквизиттер', 'Реквизиты для перевода', 'Transfer details')}>
                    {manualConfig.bankName && <div><span>{pick(language, 'Банк', 'Банк', 'Bank')}</span><strong>{manualConfig.bankName}</strong></div>}
                    {manualConfig.recipient && <div><span>{pick(language, 'Алуучу', 'Получатель', 'Recipient')}</span><strong>{manualConfig.recipient}</strong></div>}
                    <div><span>{pick(language, 'Эсеп / номер', 'Счёт / номер', 'Account / number')}</span><strong>{manualConfig.account}</strong></div>
                    <div><span>{pick(language, 'Сумма', 'Сумма', 'Amount')}</span><strong>{plan.price} {currency}</strong></div>
                    {subscription.accountId && <div><span>{pick(language, 'Төлөмдүн комментарийи', 'Комментарий к платежу', 'Payment comment')}</span><strong>LevelUp {subscription.accountId} {plan.name}</strong></div>}
                    {manualConfig.instructions && <p>{manualConfig.instructions}</p>}
                  </div>
                  <div className="checkout-fields">
                    <label className={fieldErrors.payerName ? 'checkout-field has-error' : 'checkout-field'}>
                      <span>{pick(language, 'Төлөөчүнүн аты-жөнү', 'ФИО плательщика', 'Payer name')} *</span>
                      <input type="text" maxLength={120} value={payerName} onChange={(event) => setPayerName(event.target.value)} aria-invalid={!!fieldErrors.payerName} />
                      {fieldErrors.payerName && <small className="field-error">{fieldErrors.payerName}</small>}
                    </label>
                    <label className={fieldErrors.paymentReference ? 'checkout-field has-error' : 'checkout-field'}>
                      <span>{pick(language, 'Төлөмдүн номери (чектен)', 'Номер платежа (из чека)', 'Payment reference (from receipt)')} *</span>
                      <input type="text" maxLength={64} autoComplete="off" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} aria-invalid={!!fieldErrors.paymentReference} />
                      {fieldErrors.paymentReference && <small className="field-error">{fieldErrors.paymentReference}</small>}
                    </label>
                    <label className="checkout-field wide">
                      <span>{pick(language, 'Чек боюнча комментарий (милдеттүү эмес)', 'Комментарий к чеку (необязательно)', 'Receipt note (optional)')}</span>
                      <input type="text" maxLength={300} value={receiptNote} onChange={(event) => setReceiptNote(event.target.value)} />
                    </label>
                  </div>
                </>
              )}
              {effectivePayMode !== 'card' && <label className={fieldErrors.confirm ? 'checkout-confirm has-error' : 'checkout-confirm'}>
                <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={kind === 'included'} />
                <span>{pick(language, `${plan.name} тарифин ${plan.price} ${currency} суммасына сатып алууну ырастайм.`, `Подтверждаю покупку тарифа ${plan.name} на сумму ${plan.price} ${currency}.`, `I confirm the purchase of ${plan.name} for ${plan.price} ${currency}.`)}</span>
              </label>}
              <Button type="submit" block size="lg" icon={ShieldCheck} disabled={kind === 'included' || phase === 'creating' || phase === 'redirecting'}>
                {phase === 'creating' ? pick(language, 'Жөнөтүлүүдө...', 'Отправляем...', 'Sending...') : phase === 'redirecting' ? pick(language, 'Төлөм барагына өтүүдө...', 'Переходим к оплате...', 'Redirecting to payment...') : `${effectivePayMode === 'card' ? pick(language, 'Төлөө', 'Оплатить', 'Pay') : pick(language, 'Жөнөтүү', 'Отправить', 'Submit')} — ${plan.price} ${currency}`}
              </Button>
              <Notification message={error} tone="error" role="alert" />
              <p className="checkout-secure"><Lock size={14} /> {effectivePayMode === 'card'
                ? pick(language, 'Карта маалыматтары (номери, мөөнөтү, CVV) серверге жөнөтүлбөйт жана сакталбайт.', 'Данные карты (номер, срок, CVV) не отправляются на сервер и не сохраняются.', 'Card details (number, expiry, CVV) are not sent to the server or stored.')
                : effectivePayMode === 'bank'
                ? pick(language, 'Карта номерин, CVV же мөөнөтүн эч качан жазбаңыз. Тариф администратор которууну ырастагандан кийин гана активдешет.', 'Никогда не вводите номер карты, CVV или срок действия. Тариф активируется только после того, как администратор подтвердит перевод.', 'Never enter a card number, CVV or expiry date. The plan activates only after the administrator confirms the transfer.')
                : pick(language, 'Төлөм төлөм системасынын барагында өтөт. LevelUp карта маалыматтарын сактабайт.', 'Оплата проходит на странице платёжной системы. LevelUp не хранит данные карт.', 'Payment happens on the payment system’s page. LevelUp does not store card details.')}</p>
              <Link to={fallbackPath} className="text-link">{t.sections.choosePlanShort}</Link>
            </form>
          )}
        </section>
      </div>
    </div>
  )
}

function FaqPage({ t }: { t: (typeof translations)[Lang] }) {
  const language = useLanguage()
  const location = useLocation()
  const fallbackPath = location.pathname.startsWith('/dashboard') ? '/dashboard' : '/home'
  return (
    <div className="container section page-block faq-page">
      <PageHero
        back={<SmartBackButton fallback={fallbackPath} label={pick(language, 'Кайтуу', 'Назад', 'Back')} />}
        eyebrow="FAQ"
        title={t.faqTitle}
        subtitle={pick(language, 'Окуу, тарифтер жана аккаунт боюнча негизги жооптор.', 'Ответы на главные вопросы об обучении, тарифах и аккаунте.', 'Answers about learning, plans and your account.')}
      />
      <div className="faq-layout">
        <div className="faq-list faq-page-list">
          {faqData.map((item) => <FAQAccordion key={item.q[language]} question={item.q[language]} answer={item.a[language]} defaultOpen={false} />)}
        </div>
        <Card as="aside" className="faq-help-card">
          <span className="ui-modal-icon"><HelpCircle size={22} /></span>
          <h3>{pick(language, 'Жооп таппадыңызбы?', 'Не нашли ответ?', 'Still have questions?')}</h3>
          <p>{pick(language, 'Колдоо кызматына жазыңыз — жардам беребиз.', 'Напишите в поддержку — мы поможем.', 'Write to support and we will help.')}</p>
          <a className="btn btn-primary full-width" href="mailto:support@levelup.kg"><Mail size={16} /> support@levelup.kg</a>
        </Card>
      </div>
    </div>
  )
}

function LegalPage({ title, kind }: { title: string; kind: 'privacy' | 'terms' }) {
  const language = useLanguage()
  const content = kind === 'privacy'
    ? (language === 'ru'
      ? 'Мы защищаем ваши данные и используем их только для работы платформы: авторизация, прогресс обучения и подписка.'
      : language === 'kg'
        ? 'Биз сиздин маалыматтарды коргойбуз жана платформанын иши үчүн гана колдонобуз: авторизация, окуу прогресси жана жазылуу.'
        : 'We protect your data and use it only for platform operations: authentication, learning progress, and subscriptions.')
    : (language === 'ru'
      ? 'Используя LevelUp, вы соглашаетесь соблюдать правила платформы и использовать контент только в рамках обучения.'
      : language === 'kg'
        ? 'LevelUp колдонгондо, платформа эрежелерин сактоого жана контентти окуу максатында гана колдонууга макул болосуз.'
        : 'By using LevelUp, you agree to follow platform rules and use content for learning purposes only.')

  return (
    <div className="container section page-block legal-page">
      <PageHero back={<SmartBackButton fallback="/home" label={pick(language, 'Кайтуу', 'Назад', 'Back')} />} eyebrow="LEVEL UP" title={title} />
      <Card className="legal-card">
        <ShieldCheck size={22} />
        <p>{content}</p>
      </Card>
    </div>
  )
}

// ─── Mobile-first building blocks ────────────────────────────────────────────

/** Start each newly opened page at the top (pages that restore their own scroll, like the catalog, do so afterwards). */
function ScrollToTopOnNavigate() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) return
    // 'instant' overrides the site-wide `scroll-behavior: smooth` so pages don't visibly scroll up.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname, hash])
  return null
}


/** Fixed bottom tab bar for phones/tablets (hidden on desktop via CSS). */
function MobileBottomNav({ t, isLoggedIn }: { t: (typeof translations)[Lang]; isLoggedIn: boolean }) {
  const location = useLocation()
  if (location.pathname.startsWith('/admin')) return null

  const path = location.pathname
  const items = [
    { to: '/home', label: t.nav.home, icon: Home, active: path === '/home' || path === '/' },
    { to: '/courses', label: t.nav.courses, icon: BookOpen, active: path.startsWith('/courses') || path === '/dashboard/courses' },
    { to: '/rating', label: t.nav.rating, icon: TrendingUp, active: path === '/rating' || path === '/dashboard/rating' },
    { to: '/reviews', label: t.nav.reviews, icon: MessageSquareText, active: path === '/reviews' || path === '/dashboard/reviews' },
    {
      to: isLoggedIn ? '/dashboard/profile' : '/auth?mode=login',
      label: t.nav.profile,
      icon: UserRound,
      active: path === '/dashboard/profile' || path === '/dashboard' || path === '/auth'
    }
  ]

  return (
    <nav className="mobile-bottom-nav" aria-label={t.footer.nav}>
      {items.map(({ to, label, icon: Icon, active }) => (
        <Link key={label} to={to} className={active ? 'mobile-bottom-nav-item active' : 'mobile-bottom-nav-item'} aria-current={active ? 'page' : undefined} onClick={() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' })}>
          <Icon size={20} strokeWidth={active ? 2.4 : 2} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  )
}

/** Eyebrow pill + title + "see all" link, as in the mobile design. */
function HomeSectionHeader({ eyebrow, title, linkTo, linkLabel }: { eyebrow: string; title: string; linkTo: string; linkLabel: string }) {
  return (
    <div className="home-section-header">
      <div>
        <span className="eyebrow home-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      <Link to={linkTo} className="home-section-link">
        {linkLabel} <ArrowRight size={16} />
      </Link>
    </div>
  )
}

/** Four platform statistics from the backend (no invented numbers). */
function HomeStatsCard({ t, siteStats, courseCount }: { t: (typeof translations)[Lang]; siteStats: SiteStats; courseCount: number }) {
  const items = [
    { icon: Users, value: siteStats.students, format: formatCompactNumber, label: t.home.statStudents, loading: siteStats.loading },
    { icon: GraduationCap, value: courseCount, format: (value: number) => String(Math.round(value)), label: t.home.statCourses, loading: false },
    { icon: Star, value: siteStats.rating, format: (value: number) => Number(value).toFixed(1), label: t.home.statRating, loading: siteStats.loading },
    { icon: Trophy, value: siteStats.completion, format: (value: number) => `${Math.round(value)}%`, label: t.home.statSuccess, loading: siteStats.loading }
  ]

  return (
    <section className="home-stats-wrap">
      <div className="container">
        <div className="home-stats-card">
          {items.map(({ icon: Icon, value, format, label, loading }) => (
            <div key={label} className="home-stat">
              <Icon size={24} className="home-stat-icon" />
              <AnimatedMetric value={value} formatter={format} loading={loading} fallback="—" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/** Horizontal course card used in the mobile "Choose your course" list. */
function HomeCourseRow({ course, t, isTop }: { course: Course; t: (typeof translations)[Lang]; isTop: boolean }) {
  const language = useLanguage()
  return (
    <Link to={`/courses/${course.id}`} className="home-course-row">
      <span className="home-course-thumb">
        {isTop && <span className="home-course-badge">{t.home.hit}</span>}
        <span className="home-course-thumb-icon" style={{ background: course.accent }}>
          <CourseDirectionIcon courseId={course.id} size={28} />
        </span>
      </span>
      <span className="home-course-body">
        <strong>{course.title[language]}</strong>
        <span className="home-course-desc">{course.description[language]}</span>
        <span className="home-course-meta">
          <span><Star size={14} className="home-course-star" fill="currentColor" /> {course.rating} <small>({course.students} {t.home.students})</small></span>
          <span><Clock3 size={14} /> {course.lessons.length} {t.home.lessons}</span>
        </span>
      </span>
      <span className="home-course-go" aria-hidden="true"><ChevronRight size={20} /></span>
    </Link>
  )
}

/** "My subscription" card on the dashboard — all values come from the backend. */
function SubscriptionPanel() {
  const language = useLanguage()
  const { plans, subscription, userEmail, refreshSubscription } = useBilling()
  const [history, setHistory] = useState<SubscriptionHistory | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [renewOpen, setRenewOpen] = useState(false)
  const current = accessPlanOf(subscription)
  const plan = plans.find((item) => item.id === current) ?? bundledPlans[0]
  const raw = subscription.rawStatus ?? 'free'
  const daysLeft = subscription.remainingDays ?? 0
  const endingSoon = current !== 'free' && daysLeft <= 3

  const loadHistory = useCallback(async () => {
    if (!userEmail) return
    try {
      setHistory(await getSubscriptionHistory(userEmail))
      setHistoryError(null)
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : String(error))
    }
  }, [userEmail])

  useEffect(() => { void loadHistory() }, [loadHistory, subscription.endsAt, subscription.rawStatus])

  const cancel = async () => {
    if (!userEmail) return
    setBusy(true)
    try {
      await cancelServerSubscription(userEmail)
      await refreshSubscription()
      setNotice(pick(language, 'Жазылуу жокко чыгарылды. Мөөнөтү бүткөнчө колдоно бересиз.', 'Подписка отменена. Доступ сохранится до конца оплаченного срока.', 'Subscription cancelled. Access stays until the end of the paid period.'))
      setConfirmCancel(false)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const statusTone = raw === 'active' ? 'green' : raw === 'cancelled' ? 'gold' : raw === 'expired' ? 'danger' : 'neutral'

  return (
    <section className={`detail-card subscription-panel plan-${current}`} id="subscription" aria-label={pick(language, 'Менин тарифим', 'Мой тариф', 'My plan')}>
      <div className="card-header-row">
        <h3><Crown size={20} /> {pick(language, 'Менин тарифим', 'Мой тариф', 'My plan')}</h3>
        <Badge tone={statusTone}>{subscriptionStatusText(subscription, language)}</Badge>
      </div>

      {endingSoon && (
        <div className="plan-expiry-warning" role="alert">
          <Clock3 size={18} />
          <span>{daysLeft <= 0
            ? pick(language, 'Тарифиңиз бүгүн бүтөт. Жеткиликтүүлүктү жоготпош үчүн узартыңыз.', 'Ваш тариф заканчивается сегодня. Продлите его, чтобы не потерять доступ.', 'Your plan ends today. Renew it to keep access.')
            : pick(language, `Тарифиңиздин бүтүшүнө ${daysLeft} күн калды. Жеткиликтүүлүктү жоготпош үчүн узартыңыз.`, `До окончания тарифа осталось ${daysLeft} дн. Продлите его, чтобы не потерять доступ.`, `Your plan ends in ${daysLeft} day(s). Renew it to keep access.`)}</span>
        </div>
      )}

      <div className="subscription-panel-grid">
        <div className="subscription-panel-plan">
          <span className="plan-tag">{PLAN_META[current].name}</span>
          <strong>{plan.label[language]}</strong>
          <span className="subscription-price">{current === 'free' ? pick(language, '0 сом', '0 сом', '0 KGS') : `${plan.price} ${plan.currency === 'KGS' ? 'сом' : plan.currency}`} <small>/ {planPeriodLabel(plan, language, translations[language])}</small></span>
          {current !== 'free' && <span className="subscription-days"><b>{daysLeft}</b> {pick(language, 'күн калды', 'дн. осталось', 'days left')}</span>}
        </div>
        <dl className="subscription-panel-dates">
          <div><dt>{pick(language, 'Сатып алынган күнү', 'Дата покупки', 'Purchased')}</dt><dd>{formatDateTime(subscription.purchasedAt, language, true)}</dd></div>
          <div><dt>{pick(language, 'Башталышы', 'Начало', 'Started')}</dt><dd>{current === 'free' ? '—' : formatDateTime(subscription.startedAt, language)}</dd></div>
          <div><dt>{pick(language, 'Бүтүшү', 'Действует до', 'Ends')}</dt><dd>{current === 'free' ? '—' : formatDateTime(subscription.endsAt, language)}</dd></div>
          {subscription.grantedByAdmin && <div><dt>{pick(language, 'Булак', 'Источник', 'Source')}</dt><dd>{pick(language, 'Администратор берген', 'Выдано администратором', 'Granted by administrator')}</dd></div>}
        </dl>
      </div>

      {subscription.pendingOrder && (
        <div className="checkout-pending-note" role="status">
          <Clock3 size={18} />
          <span>{subscription.pendingOrder.provider === 'manual'
            ? pick(language, 'Төлөм текшерилүүдө', 'Платёж на проверке', 'Payment under review')
            : pick(language, 'Бүтпөгөн төлөм бар', 'Есть незавершённая оплата', 'There is an unfinished payment')}: {PLAN_META[subscription.pendingOrder.planId]?.name} · {subscription.pendingOrder.amount} сом · {subscription.pendingOrder.paymentMethod}{subscription.pendingOrder.orderCode ? ` · ${subscription.pendingOrder.orderCode}` : ''}</span>
          <Link className="text-link" to={`/pricing/checkout/${subscription.pendingOrder.planId}?orderId=${encodeURIComponent(subscription.pendingOrder.orderId)}`}>{pick(language, 'Статусту көрүү', 'Посмотреть статус', 'View status')}</Link>
        </div>
      )}

      <div className="subscription-panel-features">
        <span>{pick(language, 'Сизге жеткиликтүү', 'Вам доступно', 'Available to you')}:</span>
        <ul>{plan.features[language].map((feature) => <li key={feature}><CheckCircle2 size={15} /> {feature}</li>)}</ul>
      </div>

      <div className="subscription-panel-actions">
        {current === 'free' && <ButtonLink to="/dashboard/pricing" icon={Rocket}>{pick(language, 'PRO тарифине өтүү', 'Перейти на PRO', 'Upgrade to PRO')}</ButtonLink>}
        {current !== 'free' && <Button icon={RefreshCw} onClick={() => setRenewOpen(true)}>{pick(language, 'Тарифти узартуу', 'Продлить тариф', 'Renew plan')}</Button>}
        {current !== 'free' && <ButtonLink to="/dashboard/pricing" variant="secondary" icon={SlidersHorizontal}>{pick(language, 'Тарифти өзгөртүү', 'Изменить тариф', 'Change plan')}</ButtonLink>}
        {raw === 'active' && current !== 'free' && <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(true)}>{pick(language, 'Жазылууну жокко чыгаруу', 'Отменить подписку', 'Cancel subscription')}</Button>}
      </div>
      <Notification message={notice} role="status" />

      <details className="subscription-history">
        <summary>{pick(language, 'Сатып алуу жана төлөм тарыхы', 'История покупок и платежей', 'Purchase & payment history')}</summary>
        <Notification message={historyError} tone="error" />
        {history && history.history.length === 0 && history.orders.length === 0 && <p className="field-note">{pick(language, 'Азырынча эч нерсе жок.', 'Пока ничего нет.', 'Nothing yet.')}</p>}
        {history && history.history.length > 0 && (
          <ul className="history-list">
            {history.history.map((item) => (
              <li key={item.id}>
                <span>{historyEventText(item.event, language)} · <b>{PLAN_META[item.planId]?.name ?? item.planId}</b>{item.amount ? ` · ${item.amount} сом` : ''}</span>
                <small>{formatDateTime(item.createdAt, language, true)}{item.endsAt ? ` → ${formatDateTime(item.endsAt, language)}` : ''}</small>
              </li>
            ))}
          </ul>
        )}
        {history && history.orders.length > 0 && (
          <>
            <h4>{pick(language, 'Төлөмдөр', 'Платежи', 'Payments')}</h4>
            <ul className="history-list">
              {history.orders.map((order) => (
                <li key={order.orderId}>
                  <span><b>{PLAN_META[order.planId]?.name ?? order.planId}</b> · {order.amount} сом · {order.paymentMethod} · <span className={`order-status order-status-${order.status}`}>{paymentStatusText(order.status, language)}</span></span>
                  <small>{order.orderCode ? `${order.orderCode} · ` : ''}{formatDateTime(order.createdAt, language, true)}{order.reviewNote ? ` · ${pick(language, 'Себеби', 'Причина', 'Reason')}: ${order.reviewNote}` : ''}</small>
                </li>
              ))}
            </ul>
          </>
        )}
      </details>

      {current !== 'free' && <PurchaseModal open={renewOpen} onClose={() => { setRenewOpen(false); void loadHistory() }} plan={plan} language={language} />}

      <Modal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        icon={X}
        title={pick(language, 'Жазылууну жокко чыгаруу керекпи?', 'Отменить подписку?', 'Cancel the subscription?')}
        actions={(
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirmCancel(false)}>{pick(language, 'Жок', 'Нет', 'No')}</Button>
            <Button variant="danger" size="sm" disabled={busy} onClick={() => { void cancel() }}>{busy ? loadingLabel(language) : pick(language, 'Ооба, жокко чыгаруу', 'Да, отменить', 'Yes, cancel')}</Button>
          </>
        )}
      >
        <p>{pick(language, `Тариф ${formatDateTime(subscription.endsAt, language)} чейин иштей берет, андан кийин акысыз тарифке өтөсүз. Акча автоматтык түрдө кайтарылбайт.`, `Тариф продолжит работать до ${formatDateTime(subscription.endsAt, language)}, затем вы перейдёте на бесплатный. Деньги автоматически не возвращаются.`, `Your plan keeps working until ${formatDateTime(subscription.endsAt, language)}, then you move to the free plan. No automatic refund is made.`)}</p>
      </Modal>
    </section>
  )
}

/** Course certificates: issued by the server for completed courses on PRO / AI PRO. */
function CertificatesPanel() {
  const language = useLanguage()
  const { subscription, isLoggedIn } = useBilling()
  const [data, setData] = useState<CertificatesResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openCert, setOpenCert] = useState<Certificate | null>(null)
  const current = accessPlanOf(subscription)

  useEffect(() => {
    if (!isLoggedIn) return
    let active = true
    getCertificates()
      .then((result) => { if (active) { setData(result); setError(null) } })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : String(err)) })
    return () => { active = false }
  }, [isLoggedIn, current])

  const certificates = data?.certificates ?? []
  return (
    <section className="detail-card certificates-panel" aria-label={pick(language, 'Сертификаттар', 'Сертификаты', 'Certificates')}>
      <div className="card-header-row">
        <h3><Award size={20} /> {pick(language, 'Сертификаттар', 'Сертификаты', 'Certificates')}</h3>
        <span className="achievements-count">{certificates.length}</span>
      </div>
      <Notification message={error} tone="error" />
      {data && !data.canEarn && (
        <div className="certificate-locked">
          <Lock size={18} />
          <span>{pick(language, 'Сертификаттар PRO жана AI PRO тарифтеринде курсту толук бүтүргөндө берилет.', 'Сертификаты выдаются на тарифах PRO и AI PRO после полного прохождения курса.', 'Certificates are issued on PRO and AI PRO after completing a full course.')}</span>
          <Link to="/dashboard/pricing" className="text-link">{pick(language, 'PRO тарифине өтүү', 'Перейти на PRO', 'Upgrade to PRO')}</Link>
        </div>
      )}
      {data && data.canEarn && certificates.length === 0 && (
        <p className="field-note">{pick(language, 'Курсту толук бүтүргөндөн кийин сертификатыңыз ушул жерде пайда болот.', 'Сертификат появится здесь после полного прохождения курса.', 'Your certificate will appear here after you complete a course.')}</p>
      )}
      {certificates.length > 0 && (
        <ul className="certificate-list">
          {certificates.map((cert) => (
            <li key={cert.id}>
              <span className="certificate-icon"><BadgeCheck size={20} /></span>
              <div>
                <strong>{cert.courseTitle[language] || cert.courseId}</strong>
                <small>{cert.id} · {formatDateTime(cert.issuedAt, language)}</small>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setOpenCert(cert)}>{pick(language, 'Ачуу', 'Открыть', 'Open')}</Button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={openCert !== null}
        onClose={() => setOpenCert(null)}
        icon={Award}
        title={pick(language, 'Сертификат', 'Сертификат', 'Certificate')}
        actions={(
          <>
            <Button variant="secondary" size="sm" onClick={() => setOpenCert(null)}>{pick(language, 'Жабуу', 'Закрыть', 'Close')}</Button>
            <Button size="sm" onClick={() => window.print()}>{pick(language, 'Басып чыгаруу / PDF', 'Печать / PDF', 'Print / PDF')}</Button>
          </>
        )}
      >
        {openCert && (
          <div className="certificate-sheet">
            <span className="certificate-brand">LEVEL UP</span>
            <h2>{pick(language, 'СЕРТИФИКАТ', 'СЕРТИФИКАТ', 'CERTIFICATE')}</h2>
            <p>{pick(language, 'Бул сертификат төмөнкүгө берилди', 'Настоящим подтверждается, что', 'This certifies that')}</p>
            <strong className="certificate-holder">{openCert.holderName}</strong>
            <p>{pick(language, 'курсту ийгиликтүү аяктады', 'успешно завершил(а) курс', 'has successfully completed the course')}</p>
            <strong className="certificate-course">{openCert.courseTitle[language] || openCert.courseId}</strong>
            <div className="certificate-meta">
              <span>{formatDateTime(openCert.issuedAt, language)}</span>
              <span>ID: {openCert.id}</span>
            </div>
          </div>
        )}
      </Modal>
    </section>
  )
}

function loadingLabel(language: Lang) {
  return translations[language].generic.loading
}

function SectionHeading({ title, eyebrow, subtitle }: { title: string; eyebrow?: string; subtitle?: string }) {
  return (
    <div className="section-heading">
      {eyebrow && <span className="eyebrow home-eyebrow">{eyebrow}</span>}
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
    </div>
  )
}

export default App
