import { spawn } from 'node:child_process';
import http from 'node:http';

const PORT = 8787;
const BASE = `http://127.0.0.1:${PORT}`;

async function request(path, options = {}) {
  const url = `${BASE}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runTests() {
  console.log('--- Starting LevelUp Backend for Automated Integration Testing ---');
  const serverProc = spawn('node', ['src/server.js'], {
    cwd: 'backend',
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  serverProc.stdout.on('data', (d) => {
    const s = d.toString();
    if (s.includes('running on port')) {
      console.log(`[Backend log]: ${s.trim()}`);
    }
  });

  serverProc.stderr.on('data', (d) => {
    console.error(`[Backend err]: ${d.toString().trim()}`);
  });

  let running = false;
  for (let i = 0; i < 30; i++) {
    await delay(300);
    try {
      const h = await request('/api/health');
      if (h.status === 200) {
        running = true;
        break;
      }
    } catch {
      // waiting
    }
  }

  if (!running) {
    console.error('Failed to start backend server');
    serverProc.kill();
    process.exit(1);
  }

  console.log('Backend server is alive and responding to /api/health!\n');

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition, testName, extraInfo = '') {
    if (condition) {
      console.log(`✅ [PASS] Scenario: ${testName}`);
      passedCount++;
    } else {
      console.error(`❌ [FAIL] Scenario: ${testName} ${extraInfo}`);
      failedCount++;
    }
  }

  try {
    // 1. Correct administrator can log in
    let adminToken = '';
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'admin@levelup.kg', password: 'admin123' }
    });
    assert(loginRes.status === 200 && loginRes.data.token && loginRes.data.user?.role === 'Admin',
      '1. Administrator login with correct credentials',
      JSON.stringify(loginRes.data)
    );
    adminToken = loginRes.data.token;

    // 2. Incorrect password rejected
    const badLoginRes = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'admin@levelup.kg', password: 'wrongpassword' }
    });
    assert(badLoginRes.status === 401, '2. Administrator login rejected on incorrect password');

    // 3. Regular user cannot access admin API endpoints (returns 403)
    const userLoginRes = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'aisha@levelup.kg', password: 'demo123' }
    });
    const regularToken = userLoginRes.data.token;
    assert(!!regularToken, '3a. Regular user (Aisha) can log in as normal user');

    const adminStatsWithUser = await request('/api/admin/stats', {
      headers: { Authorization: `Bearer ${regularToken}` }
    });
    assert(adminStatsWithUser.status === 403, '3b. Regular user is rejected with HTTP 403 on admin endpoints');

    // Unauthenticated request returns 401
    const unauthStats = await request('/api/admin/stats');
    assert(unauthStats.status === 401, '3c. Unauthenticated request is rejected with HTTP 401 on admin endpoints');

    // 4. Second administrator cannot be registered & role escalation blocked
    const regAdminRes = await request('/api/auth/register', {
      method: 'POST',
      body: { name: 'Hacker', email: 'admin@levelup.kg', password: 'password123' }
    });
    assert(regAdminRes.status === 409, '4a. Registration with admin email is strictly blocked (HTTP 409)');

    const regNewUser = await request('/api/auth/register', {
      method: 'POST',
      body: { name: 'Normal User', email: 'normaluser@test.kg', password: 'normalpassword123' }
    });
    assert(regNewUser.status === 201 && regNewUser.data.user.role === 'User',
      '4b. Public registration always creates role="User"'
    );

    // Profile escalation attempt
    const hackProfile = await request(`/api/users/normaluser@test.kg/profile`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${regNewUser.data.token}` },
      body: { firstName: 'Hacked', role: 'Admin' }
    });
    assert(hackProfile.status === 200 && hackProfile.data.user.role === 'User',
      '4c. Profile update endpoint ignores and prevents role escalation to Admin'
    );

    // 5. Forgot Password workflow & rate limiting / tokens
    const forgotRes = await request('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: 'admin@levelup.kg' }
    });
    assert(forgotRes.status === 200 && forgotRes.data.ok === true,
      '5. Forgot Password endpoint accepts email and processes token'
    );

    // Read generated token directly from DB or inspect
    const { default: Database } = await import('better-sqlite3');
    const testDb = new Database('backend/levelup.sqlite');
    const tokenRow = testDb.prepare('SELECT * FROM password_reset_tokens WHERE user_email = ? AND used = 0 ORDER BY created_at DESC LIMIT 1').get('admin@levelup.kg');
    assert(!!tokenRow && !!tokenRow.token_hash, '5b. Secure password reset token created in database');

    // 6. Verify valid reset token and reset password
    // We need the raw token or test token verification
    // In our backend, token_hash is SHA256 of raw hex token.
    // Let's create a known token directly in DB to test the full verify & reset flow:
    const crypto = await import('node:crypto');
    const testRawToken = crypto.randomBytes(32).toString('hex');
    const testTokenHash = crypto.createHash('sha256').update(testRawToken).digest('hex');
    const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    testDb.prepare('INSERT INTO password_reset_tokens (id, user_email, token_hash, expires_at, used, created_at) VALUES (?, ?, ?, ?, 0, ?)').run(
      'test-tok-' + Date.now(),
      'admin@levelup.kg',
      testTokenHash,
      expiry,
      new Date().toISOString()
    );

    const verifyRes = await request(`/api/auth/reset-password/verify?email=admin@levelup.kg&token=${testRawToken}`);
    assert(verifyRes.status === 200 && verifyRes.data.valid === true,
      '6a. Verification of valid reset token succeeds'
    );

    const resetRes = await request('/api/auth/reset-password', {
      method: 'POST',
      body: { email: 'admin@levelup.kg', token: testRawToken, password: 'newadminpass123' }
    });
    assert(resetRes.status === 200 && resetRes.data.ok === true,
      '6b. Password reset with valid token succeeds'
    );

    // 7. Expired reset link rejected
    const expiredRawToken = crypto.randomBytes(32).toString('hex');
    const expiredHash = crypto.createHash('sha256').update(expiredRawToken).digest('hex');
    const pastExpiry = new Date(Date.now() - 60 * 1000).toISOString();
    testDb.prepare('INSERT INTO password_reset_tokens (id, user_email, token_hash, expires_at, used, created_at) VALUES (?, ?, ?, ?, 0, ?)').run(
      'expired-tok-' + Date.now(),
      'admin@levelup.kg',
      expiredHash,
      pastExpiry,
      new Date().toISOString()
    );
    const verifyExpired = await request(`/api/auth/reset-password/verify?email=admin@levelup.kg&token=${expiredRawToken}`);
    assert(verifyExpired.status === 400 || (verifyExpired.data && verifyExpired.data.valid === false),
      '7. Expired password reset token is rejected'
    );

    // 8. Reusing the used reset token is rejected
    const reuseRes = await request('/api/auth/reset-password', {
      method: 'POST',
      body: { email: 'admin@levelup.kg', token: testRawToken, password: 'attemptreuse123' }
    });
    assert(reuseRes.status === 400, '8. Reset token cannot be reused after it was used');

    // 9. Login with new password from reset
    const loginWithNew = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'admin@levelup.kg', password: 'newadminpass123' }
    });
    assert(loginWithNew.status === 200 && !!loginWithNew.data.token,
      '9. Administrator can log in with new password'
    );
    const currentAdminToken = loginWithNew.data.token;

    // 10. Change password via Admin Settings (Security tab)
    const changePassRes = await request('/api/admin/settings/password', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${currentAdminToken}` },
      body: { currentPassword: 'newadminpass123', newPassword: 'finaladminpass2026' }
    });
    assert(changePassRes.status === 200 && changePassRes.data.ok === true,
      '10a. Administrator can change password in Admin Settings'
    );

    // 10b. Old password no longer works
    const oldLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'admin@levelup.kg', password: 'newadminpass123' }
    });
    assert(oldLogin.status === 401, '10b. Old password no longer works after password change');

    // 11. New changed password works and re-logins
    const finalLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'admin@levelup.kg', password: 'finaladminpass2026' }
    });
    assert(finalLogin.status === 200 && !!finalLogin.data.token,
      '11. New password functions properly on login'
    );
    const activeAdminToken = finalLogin.data.token;

    // 12. Admin dashboard statistics reflect real database data
    const statsRes = await request('/api/admin/stats', {
      headers: { Authorization: `Bearer ${activeAdminToken}` }
    });
    assert(statsRes.status === 200 && statsRes.data.totalCourses >= 8 && statsRes.data.totalLessons >= 160,
      '12. Admin dashboard stats dynamically reflect real database counts',
      `Courses: ${statsRes.data.totalCourses}, Lessons: ${statsRes.data.totalLessons}, Users: ${statsRes.data.totalUsers}`
    );

    // 13. CRUD Operations Test:
    // Course CRUD
    const createCourseRes = await request('/api/admin/courses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${activeAdminToken}` },
      body: {
        id: 'test-course-automation',
        badge: 'DevOps',
        title_ru: 'Тестовый курс DevOps',
        title_kg: 'DevOps сыноо курсу',
        title_en: 'DevOps Test Course',
        description_ru: 'Описание тестового курса',
        category: 'DevOps',
        level: 'Intermediate',
        duration: '2 недели',
        isPublished: true
      }
    });
    assert(createCourseRes.status === 201 && createCourseRes.data.course?.id === 'test-course-automation',
      '13a. Create Course CRUD succeeds'
    );

    const updateCourseRes = await request('/api/admin/courses/test-course-automation', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${activeAdminToken}` },
      body: {
        title_ru: 'Обновленный DevOps курс',
        category: 'Cloud'
      }
    });
    assert(updateCourseRes.status === 200 && updateCourseRes.data.course?.title_ru === 'Обновленный DevOps курс',
      '13b. Update Course CRUD succeeds'
    );

    // Lesson CRUD
    const createLessonRes = await request('/api/admin/lessons', {
      method: 'POST',
      headers: { Authorization: `Bearer ${activeAdminToken}` },
      body: {
        courseId: 'test-course-automation',
        title_ru: 'Урок 1: Введение в Docker',
        title_kg: '1-сабак: Docker киришүү',
        title_en: 'Lesson 1: Intro to Docker',
        duration: '25 мин',
        type: 'Видеоурок',
        theory: 'Docker контейнеризация теориясы...',
        code: 'docker run hello-world',
        task: 'Установите Docker'
      }
    });
    assert(createLessonRes.status === 201 && !!createLessonRes.data.lesson?.id,
      '13c. Create Lesson CRUD succeeds'
    );
    const createdLessonId = createLessonRes.data.lesson.id;

    // Lesson Order / Reorder
    const reorderLesson = await request(`/api/admin/lessons/${createdLessonId}/order`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${activeAdminToken}` },
      body: { direction: 'down' }
    });
    assert(reorderLesson.status === 200 && reorderLesson.data.ok === true,
      '13d. Reorder Lesson (▲/▼) endpoint succeeds'
    );

    // Delete Lesson
    const delLessonRes = await request(`/api/admin/lessons/${createdLessonId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${activeAdminToken}` }
    });
    assert(delLessonRes.status === 200 && delLessonRes.data.ok === true,
      '13e. Delete Lesson CRUD succeeds'
    );

    // Delete Course
    const delCourseRes = await request('/api/admin/courses/test-course-automation', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${activeAdminToken}` }
    });
    assert(delCourseRes.status === 200 && delCourseRes.data.ok === true,
      '13f. Delete Course CRUD succeeds'
    );

    // User Management CRUD (block/unblock)
    const blockUser = await request('/api/admin/users/normaluser@test.kg/block', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${activeAdminToken}` },
      body: { blocked: true }
    });
    assert(blockUser.status === 200 && blockUser.data.user?.isBlocked === true,
      '13g. Block User in User Management succeeds'
    );

    const unblockUser = await request('/api/admin/users/normaluser@test.kg/block', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${activeAdminToken}` },
      body: { blocked: false }
    });
    assert(unblockUser.status === 200 && unblockUser.data.user?.isBlocked === false,
      '13h. Unblock User in User Management succeeds'
    );

    // Subscriptions & AI Pro Management
    const grantSub = await request('/api/admin/subscriptions/grant', {
      method: 'POST',
      headers: { Authorization: `Bearer ${activeAdminToken}` },
      body: {
        userEmail: 'normaluser@test.kg',
        planId: 'aipro',
        durationDays: 30
      }
    });
    assert(grantSub.status === 200 && grantSub.data.ok === true,
      '13i. Grant AI Pro / Subscription to user succeeds'
    );

    // AI Pro system toggle
    const toggleAiSystem = await request('/api/admin/ai-pro/system-toggle', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${activeAdminToken}` },
      body: { enabled: true }
    });
    assert(toggleAiSystem.status === 200 && toggleAiSystem.data.enabled === true,
      '13j. AI Pro system-wide availability toggle succeeds'
    );

    // Test AI Chat backend authorization check
    const aiChatWithAiPro = await request('/api/ai/chat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${regNewUser.data.token}` },
      body: { message: 'Привет! Помоги с кодом на Python' }
    });
    assert(aiChatWithAiPro.status === 200 && !!aiChatWithAiPro.data.reply,
      '13k. AI Assistant chat works for user with active AI Pro'
    );

    // 14. Admin logout
    const logoutRes = await request('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${activeAdminToken}` }
    });
    assert(logoutRes.status === 200, '14a. Admin logout endpoint returns 200');

    // After logout, session is revoked and admin stats can no longer be accessed with that token
    const afterLogoutStats = await request('/api/admin/stats', {
      headers: { Authorization: `Bearer ${activeAdminToken}` }
    });
    assert(afterLogoutStats.status === 401,
      '14b. Revoked session token cannot access protected admin pages/endpoints'
    );

    // Reset password back to admin123 for convenience if needed, using the database directly
    const bcrypt = await import('bcrypt');
    const finalHash = bcrypt.hashSync('admin123', 12);
    testDb.prepare('UPDATE user_profiles SET password_hash = ? WHERE user_email = ?').run(finalHash, 'admin@levelup.kg');
    testDb.close();

    console.log(`\n========================================`);
    console.log(`TOTAL TESTS: ${passedCount + failedCount}`);
    console.log(`PASSED: ${passedCount}`);
    console.log(`FAILED: ${failedCount}`);
    console.log(`========================================\n`);

  } catch (err) {
    console.error('Test suite failed with exception:', err);
    failedCount++;
  } finally {
    serverProc.kill();
  }

  process.exit(failedCount > 0 ? 1 : 0);
}

runTests();
