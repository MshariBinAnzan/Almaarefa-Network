(function () {
  const { getInitials, pluralize, formatShortDate, formatEventDate, escapeHtml } = window.Validators;

  const state = {
    user: window.AuthService.getCurrentUser(),
    activeSection: new URLSearchParams(window.location.search).get('tab') || 'feed',
    feedFilter: 'ALL',
    newPostContent: '',
    newPostType: 'ACADEMIC',
    posts: [...window.AlmaarefaData.MOCK_POSTS],
    classGroups: [...window.AlmaarefaData.MOCK_CLASS_GROUPS],
    clubs: [...window.AlmaarefaData.MOCK_CLUBS],
    events: [...window.AlmaarefaData.MOCK_EVENTS],
    reportedPostIds: new Set(),
    verificationSubmitted: false,
    idFile: null,
    idFileError: null,
    confirmingDelete: false,
    reportResolved: false,
  };

  let toastTimer = null;

  function showToast(msg) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    if (toastTimer) clearTimeout(toastTimer);

    container.innerHTML = `
      <div class="pointer-events-auto max-w-sm bg-[#0f172a] text-[#f8fafc] ps-4 pe-2 py-2 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 border border-[#334155]">
        <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-400 shrink-0"></i>
        <span class="flex-1">${escapeHtml(msg)}</span>
        <button type="button" id="dismiss-toast" class="p-2 rounded-lg text-[#cbd5e1] hover:text-[#ffffff] hover:bg-[#1e293b] transition-colors cursor-pointer">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>
    `;
    window.lucide.createIcons();
    document.getElementById('dismiss-toast')?.addEventListener('click', () => {
      container.innerHTML = '';
    });
    toastTimer = setTimeout(() => {
      container.innerHTML = '';
    }, 4000);
  }

  function getNavItems() {
    const items = [
      { id: 'feed', label: 'Campus Feed', icon: 'home' },
      { id: 'courses', label: 'Course Groups', icon: 'book-open' },
      { id: 'clubs', label: 'Student Clubs', icon: 'users' },
      { id: 'calendar', label: 'Events Calendar', icon: 'calendar' },
      { id: 'profile', label: 'My Profile & ID', icon: 'user' },
    ];
    if (state.user?.role === 'ADMIN') {
      items.push({ id: 'admin', label: 'Moderation Panel', icon: 'shield-alert' });
    }
    return items;
  }

  function renderShell() {
    const { user } = state;
    if (state.activeSection === 'admin' && user.role !== 'ADMIN') {
      state.activeSection = 'feed';
    }

    // Persona Select Sync
    const personaSelect = document.getElementById('persona-switcher');
    if (personaSelect) {
      const matchKey = Object.keys(window.AlmaarefaData.MOCK_USERS).find(
        (k) => window.AlmaarefaData.MOCK_USERS[k].userId === user.userId
      );
      if (matchKey) personaSelect.value = matchKey;
    }

    // Navbar User
    const navUser = document.getElementById('navbar-user');
    if (navUser) {
      navUser.innerHTML = `
        <div class="text-end hidden sm:block">
          <div class="flex items-center justify-end gap-1">
            <span class="text-sm font-semibold text-slate-900">${escapeHtml(user.profile.fullName)}</span>
            ${
              user.isVerified
                ? '<i data-lucide="check-circle-2" class="w-4 h-4 text-brand-600 shrink-0"></i>'
                : '<i data-lucide="alert-triangle" class="w-4 h-4 text-amber-500 shrink-0"></i>'
            }
          </div>
          <div class="flex items-center justify-end gap-1.5 text-xs text-slate-500">
            <span>${escapeHtml(user.profile.departmentName || user.universityEmail)}</span>
            <span class="px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded font-medium text-[10px]">${user.role}</span>
          </div>
        </div>
        <div class="w-9 h-9 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-sm border border-brand-200">
          ${getInitials(user.profile.fullName)}
        </div>
        <button type="button" id="logout-btn" title="Sign out" class="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer">
          <i data-lucide="log-out" class="w-4 h-4"></i>
        </button>
      `;
    }

    // Unverified Banner & Trust Card
    const banner = document.getElementById('unverified-banner');
    if (banner) banner.classList.toggle('hidden', !!user.isVerified);
    const trustStatus = document.getElementById('trust-card-status');
    if (trustStatus) {
      trustStatus.textContent = `Status: ${user.isVerified ? 'Verified ID' : 'Pending ID Proof'}`;
    }

    // Desktop & Mobile Navigation
    const navItems = getNavItems();
    const desktopNav = document.getElementById('desktop-nav');
    if (desktopNav) {
      desktopNav.innerHTML = navItems
        .map((item) => {
          const isActive = state.activeSection === item.id;
          return `
            <button
              type="button"
              data-nav-section="${item.id}"
              class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition text-start cursor-pointer ${
                isActive
                  ? 'bg-brand-50 text-brand-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }"
            >
              <i data-lucide="${item.icon}" class="w-5 h-5 ${isActive ? 'text-brand-600' : 'text-slate-400'}"></i>
              <span>${item.label}</span>
            </button>
          `;
        })
        .join('');
    }

    const mobileNav = document.getElementById('mobile-nav');
    if (mobileNav) {
      mobileNav.innerHTML = navItems
        .slice(0, 5)
        .map((item) => {
          const isActive = state.activeSection === item.id;
          return `
            <button
              type="button"
              data-nav-section="${item.id}"
              class="flex flex-col items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium cursor-pointer ${
                isActive ? 'text-brand-700 font-semibold' : 'text-slate-500'
              }"
            >
              <i data-lucide="${item.icon}" class="w-5 h-5"></i>
              <span>${item.label.split(' ')[0]}</span>
            </button>
          `;
        })
        .join('');
    }

    renderMainSection();
    window.lucide.createIcons();
  }

  function renderMainSection() {
    const main = document.getElementById('main-content');
    if (!main) return;

    if (state.activeSection === 'feed') main.innerHTML = renderFeedSection();
    else if (state.activeSection === 'courses') main.innerHTML = renderCoursesSection();
    else if (state.activeSection === 'clubs') main.innerHTML = renderClubsSection();
    else if (state.activeSection === 'calendar') main.innerHTML = renderCalendarSection();
    else if (state.activeSection === 'profile') main.innerHTML = renderProfileSection();
    else if (state.activeSection === 'admin') main.innerHTML = renderAdminSection();
  }

  function renderFeedSection() {
    const { user } = state;
    const firstName = user.profile.fullName.split(' ')[0];
    const filteredPosts = state.posts.filter(
      (p) => state.feedFilter === 'ALL' || p.postType === state.feedFilter
    );

    const typeMeta = {
      ACADEMIC: { label: 'Course Q&A', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
      CLUB_EVENT: { label: 'Club Activity', cls: 'bg-teal-50 text-teal-700 border-teal-200' },
      GENERAL: { label: 'Campus Update', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
    };

    const tabs = [
      { id: 'ALL', label: 'All Activity' },
      { id: 'ACADEMIC', label: 'Course Discussions' },
      { id: 'CLUB_EVENT', label: 'Club Announcements' },
      { id: 'GENERAL', label: 'Campus Updates' },
    ];

    return `
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div class="lg:col-span-8 space-y-5">
          <!-- Post Composer -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
            ${
              user.isVerified
                ? `
              <form id="post-composer-form">
                <div class="flex items-start gap-3">
                  <div class="w-10 h-10 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-sm shrink-0">
                    ${getInitials(user.profile.fullName)}
                  </div>
                  <div class="flex-1 min-w-0">
                    <textarea
                      id="post-composer-input"
                      rows="3"
                      maxlength="2000"
                      placeholder="Ask a course question or share an update, ${escapeHtml(firstName)}…"
                      class="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl p-3 focus:bg-white focus:border-brand-500 focus:outline-none resize-y transition-colors"
                    >${escapeHtml(state.newPostContent)}</textarea>
                    <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <div class="flex flex-wrap items-center gap-2">
                        <select id="post-type-select" class="text-xs bg-slate-100 border border-slate-200 rounded-lg px-2.5 min-h-9 font-medium text-slate-700 cursor-pointer">
                          <option value="ACADEMIC" ${state.newPostType === 'ACADEMIC' ? 'selected' : ''}>Academic / Course Q&A</option>
                          <option value="GENERAL" ${state.newPostType === 'GENERAL' ? 'selected' : ''}>General Campus Discussion</option>
                        </select>
                        <button type="button" data-toast="File attachments are coming soon." class="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-brand-700 px-2.5 min-h-9 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                          <i data-lucide="paperclip" class="w-3.5 h-3.5"></i>
                          <span>Attach file</span>
                        </button>
                      </div>
                      <button type="submit" class="inline-flex items-center gap-1.5 bg-brand-700 hover:bg-brand-800 text-[#ffffff] text-sm font-semibold px-4 min-h-10 rounded-xl transition-colors shadow-sm cursor-pointer">
                        <i data-lucide="send" class="w-4 h-4"></i>
                        <span>Publish</span>
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            `
                : `
              <div class="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <i data-lucide="shield-check" class="w-8 h-8 text-amber-600 shrink-0"></i>
                <div class="flex-1">
                  <p class="text-sm font-semibold text-slate-900">Verify your Student ID to start posting</p>
                  <p class="text-xs text-slate-600 mt-0.5">You can read every feed now. Posting unlocks once Student Affairs confirms your ID.</p>
                </div>
                <button type="button" data-nav-section="profile" class="bg-brand-700 hover:bg-brand-800 text-[#ffffff] text-sm font-semibold px-4 min-h-11 rounded-xl transition-colors shrink-0 cursor-pointer">
                  Verify Student ID
                </button>
              </div>
            `
            }
          </div>

          <!-- Feed Filter Tabs -->
          <div class="flex items-center gap-1 overflow-x-auto bg-white rounded-xl p-1.5 border border-slate-200 shadow-sm">
            ${tabs
              .map(
                (t) => `
              <button
                type="button"
                data-feed-filter="${t.id}"
                class="flex-1 whitespace-nowrap min-h-9 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  state.feedFilter === t.id
                    ? 'bg-brand-700 text-[#ffffff] shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }"
              >
                ${t.label}
              </button>
            `
              )
              .join('')}
          </div>

          <!-- Posts List -->
          <div class="space-y-4">
            ${filteredPosts
              .map((post) => {
                const meta = typeMeta[post.postType] || typeMeta.GENERAL;
                const isReported = state.reportedPostIds.has(post.postId);
                return `
                  <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3.5">
                    <div class="flex items-start justify-between gap-3">
                      <div class="flex items-center gap-3 min-w-0">
                        <div class="w-10 h-10 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-sm border border-slate-200 shrink-0">
                          ${getInitials(post.author.fullName)}
                        </div>
                        <div class="min-w-0">
                          <div class="flex flex-wrap items-center gap-x-1.5">
                            <h2 class="text-sm font-bold text-slate-900">${escapeHtml(post.author.fullName)}</h2>
                            ${post.author.isVerified ? '<i data-lucide="check-circle-2" class="w-4 h-4 text-brand-600"></i>' : ''}
                            <span class="text-xs text-slate-500">@${escapeHtml(post.author.username)}</span>
                          </div>
                          <p class="text-xs text-slate-500">
                            ${escapeHtml(post.author.departmentName || 'Almaarefa University')} · ${formatShortDate(post.createdAt)}
                          </p>
                        </div>
                      </div>
                      <span class="text-[11px] font-semibold px-2.5 py-1 rounded-full border shrink-0 ${meta.cls}">
                        ${meta.label}
                      </span>
                    </div>

                    <p class="text-sm text-slate-800 leading-relaxed whitespace-pre-line break-words">${escapeHtml(post.content)}</p>

                    ${
                      post.attachments?.length
                        ? `<ul class="space-y-2 pt-1">
                            ${post.attachments
                              .map(
                                (att) => `
                              <li class="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                                <div class="flex items-center gap-2.5 min-w-0">
                                  <i data-lucide="file-text" class="w-5 h-5 text-brand-600 shrink-0"></i>
                                  <div class="min-w-0">
                                    <div class="text-xs font-semibold text-slate-900 truncate">${escapeHtml(att.name)}</div>
                                    <div class="text-[11px] text-slate-500">${(att.sizeBytes / 1024).toFixed(0)} KB</div>
                                  </div>
                                </div>
                                <button type="button" data-toast="Downloading ${escapeHtml(att.name)}…" class="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 px-3 min-h-9 rounded-lg transition-colors cursor-pointer">
                                  <i data-lucide="download" class="w-4 h-4"></i>
                                  <span>Download</span>
                                </button>
                              </li>
                            `
                              )
                              .join('')}
                          </ul>`
                        : ''
                    }

                    <div class="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-600">
                      <div class="flex items-center gap-2">
                        <button type="button" data-like-post="${post.postId}" class="inline-flex items-center gap-1.5 font-medium px-2.5 min-h-9 rounded-lg transition-colors cursor-pointer ${
                          post.stats.hasLiked ? 'text-rose-600 font-semibold hover:bg-rose-50' : 'hover:text-slate-900 hover:bg-slate-100'
                        }">
                          <i data-lucide="heart" class="w-4 h-4"></i>
                          <span>${pluralize(post.stats.likesCount, 'Like')}</span>
                        </button>
                        <button type="button" data-toast="Replies are coming soon." class="inline-flex items-center gap-1.5 font-medium px-2.5 min-h-9 rounded-lg hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer">
                          <i data-lucide="message-square" class="w-4 h-4"></i>
                          <span>${pluralize(post.stats.commentsCount, 'Reply', 'Replies')}</span>
                        </button>
                      </div>
                      <button type="button" data-report-post="${post.postId}" ${isReported ? 'disabled' : ''} class="inline-flex items-center gap-1.5 px-2.5 min-h-9 rounded-lg transition-colors cursor-pointer text-slate-500 hover:text-red-700 hover:bg-red-50">
                        <i data-lucide="flag" class="w-3.5 h-3.5"></i>
                        <span>${isReported ? 'Reported' : 'Report'}</span>
                      </button>
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>

        <!-- Right Widgets -->
        <aside class="lg:col-span-4 space-y-6">
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div class="flex items-center justify-between mb-3.5">
              <h2 class="text-sm font-bold text-slate-900 flex items-center gap-2">
                <i data-lucide="book-open" class="w-4 h-4 text-brand-600"></i>
                <span>Official Course Groups</span>
              </h2>
              <button type="button" data-nav-section="courses" class="text-xs font-semibold text-brand-700 hover:underline cursor-pointer">View all</button>
            </div>
            <ul class="space-y-3">
              ${state.classGroups
                .map(
                  (g) => `
                <li class="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                  <div class="min-w-0">
                    <span class="text-[11px] font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded">${g.courseCode}</span>
                    <h3 class="text-xs font-semibold text-slate-900 mt-1">${escapeHtml(g.courseName)}</h3>
                    <p class="text-[11px] text-slate-500">${g.semester} · ${pluralize(g.membersCount, 'student')}</p>
                  </div>
                  <button type="button" data-toggle-group="${g.groupId}" class="inline-flex items-center justify-center gap-1.5 font-semibold rounded-xl border text-xs px-3 min-h-9 shrink-0 cursor-pointer ${
                    g.isMember
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-brand-700 text-[#ffffff] border-brand-700'
                  }">
                    ${g.isMember ? 'Joined' : 'Join'}
                  </button>
                </li>
              `
                )
                .join('')}
            </ul>
          </div>

          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div class="flex items-center justify-between mb-3.5">
              <h2 class="text-sm font-bold text-slate-900 flex items-center gap-2">
                <i data-lucide="calendar" class="w-4 h-4 text-brand-600"></i>
                <span>Upcoming Campus Events</span>
              </h2>
              <button type="button" data-nav-section="calendar" class="text-xs font-semibold text-brand-700 hover:underline cursor-pointer">View calendar</button>
            </div>
            <ul class="space-y-3">
              ${state.events
                .map(
                  (ev) => `
                <li class="p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                  <div class="text-[11px] font-semibold text-brand-700">${escapeHtml(ev.club.name)}</div>
                  <h3 class="text-xs font-bold text-slate-900">${escapeHtml(ev.title)}</h3>
                  <div class="flex items-center gap-1.5 text-[11px] text-slate-600">
                    <i data-lucide="calendar" class="w-3.5 h-3.5 text-slate-500"></i>
                    <span>${formatEventDate(ev.startTime)}</span>
                  </div>
                  <div class="flex items-center gap-1.5 text-[11px] text-slate-600">
                    <i data-lucide="map-pin" class="w-3.5 h-3.5 text-slate-500"></i>
                    <span>${escapeHtml(ev.location)}</span>
                  </div>
                  <div class="pt-1.5 flex items-center justify-between gap-2">
                    <span class="text-[11px] text-slate-500">${pluralize(ev.rsvpCount, 'student')} going</span>
                    <button type="button" data-toggle-event="${ev.eventId}" class="inline-flex items-center justify-center gap-1.5 font-semibold rounded-xl border text-xs px-3 min-h-9 shrink-0 cursor-pointer ${
                      ev.hasRsvp
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-brand-700 text-[#ffffff] border-brand-700'
                    }">
                      ${ev.hasRsvp ? 'Going' : 'RSVP'}
                    </button>
                  </div>
                </li>
              `
                )
                .join('')}
            </ul>
          </div>
        </aside>
      </div>
    `;
  }

  function renderCoursesSection() {
    return `
      <div class="space-y-5">
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h1 class="text-xl font-bold text-slate-900">Official Course Communities</h1>
          <p class="text-sm text-slate-600 mt-1">Class groups linked to the Almaarefa University academic catalog for this semester.</p>
        </div>
        <ul class="grid grid-cols-1 xl:grid-cols-2 gap-4">
          ${state.classGroups
            .map(
              (g) => `
            <li class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between gap-4">
              <div>
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs font-bold px-2.5 py-1 rounded-lg bg-brand-50 text-brand-700">${g.courseCode}</span>
                  <span class="text-xs text-slate-500">${g.semester}</span>
                </div>
                <h2 class="text-base font-bold text-slate-900 mt-2">${escapeHtml(g.title)}</h2>
                <p class="text-sm text-slate-600 mt-1">${escapeHtml(g.description)}</p>
              </div>
              <div class="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <span class="text-xs text-slate-600"><strong class="text-slate-900">${g.membersCount}</strong> verified students enrolled</span>
                <button type="button" data-toggle-group="${g.groupId}" class="inline-flex items-center justify-center gap-1.5 font-semibold rounded-xl border text-sm px-4 min-h-11 cursor-pointer ${
                  g.isMember
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-brand-700 text-[#ffffff] border-brand-700'
                }">
                  ${g.isMember ? 'Joined' : 'Join class group'}
                </button>
              </div>
            </li>
          `
            )
            .join('')}
        </ul>
      </div>
    `;
  }

  function renderClubsSection() {
    return `
      <div class="space-y-5">
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 class="text-xl font-bold text-slate-900">Recognized Student Clubs</h1>
            <p class="text-sm text-slate-600 mt-1">Follow official clubs, join committees, or propose a new student organization.</p>
          </div>
          <button type="button" data-toast="Club proposals are coming soon." class="inline-flex items-center gap-1.5 bg-brand-700 hover:bg-brand-800 text-[#ffffff] text-sm font-semibold px-4 min-h-11 rounded-xl cursor-pointer">
            <i data-lucide="plus" class="w-4 h-4"></i>
            <span>Propose new club</span>
          </button>
        </div>
        <ul class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          ${state.clubs
            .map(
              (c) => `
            <li class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between gap-4">
              <div>
                <span class="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">${escapeHtml(c.category)}</span>
                <h2 class="text-base font-bold text-slate-900 mt-2">${escapeHtml(c.name)}</h2>
                <p class="text-sm text-slate-600 mt-1">${escapeHtml(c.description)}</p>
              </div>
              <div class="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <span class="text-xs text-slate-600">${pluralize(c.membersCount, 'member')}</span>
                <button type="button" data-toggle-club="${c.clubId}" class="inline-flex items-center justify-center gap-1.5 font-semibold rounded-xl border text-xs px-3 min-h-9 cursor-pointer ${
                  c.isFollowing
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-brand-700 text-[#ffffff] border-brand-700'
                }">
                  ${c.isFollowing ? 'Following' : 'Follow'}
                </button>
              </div>
            </li>
          `
            )
            .join('')}
        </ul>
      </div>
    `;
  }

  function renderCalendarSection() {
    return `
      <div class="space-y-5">
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h1 class="text-xl font-bold text-slate-900">Campus Event Calendar</h1>
          <p class="text-sm text-slate-600 mt-1">Every upcoming Almaarefa University workshop, club activity, and seminar in one place.</p>
        </div>
        <ul class="space-y-4">
          ${state.events
            .map(
              (ev) => `
            <li class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div class="space-y-1.5">
                <span class="text-xs font-bold text-brand-700">${escapeHtml(ev.club.name)}</span>
                <h2 class="text-base font-bold text-slate-900">${escapeHtml(ev.title)}</h2>
                <p class="text-sm text-slate-600">${escapeHtml(ev.description)}</p>
                <div class="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-slate-600">
                  <span>${formatEventDate(ev.startTime)}</span>
                  <span>· ${escapeHtml(ev.location)}</span>
                  <span>· ${ev.rsvpCount} going</span>
                </div>
              </div>
              <button type="button" data-toggle-event="${ev.eventId}" class="inline-flex items-center justify-center gap-1.5 font-semibold rounded-xl border text-sm px-4 min-h-11 shrink-0 cursor-pointer ${
                ev.hasRsvp
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-brand-700 text-[#ffffff] border-brand-700'
              }">
                ${ev.hasRsvp ? 'Going' : 'RSVP'}
              </button>
            </li>
          `
            )
            .join('')}
        </ul>
      </div>
    `;
  }

  function renderProfileSection() {
    const { user } = state;
    return `
      <div class="space-y-6">
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex items-center gap-4">
          <div class="w-16 h-16 rounded-2xl bg-brand-100 text-brand-700 font-bold text-xl flex items-center justify-center border border-brand-200 shrink-0">
            ${getInitials(user.profile.fullName)}
          </div>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-xl font-bold text-slate-900">${escapeHtml(user.profile.fullName)}</h1>
              <span class="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                user.isVerified
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }">
                ${user.isVerified ? 'Verified Student' : 'Verification pending'}
              </span>
            </div>
            <p class="text-sm text-slate-600 mt-0.5">@${escapeHtml(user.profile.username)} · ${escapeHtml(user.universityEmail)}</p>
            <p class="text-xs text-slate-600 mt-1">
              Department: <strong class="text-slate-900">${escapeHtml(user.profile.departmentName || 'Computer Science')}</strong>
              ${user.profile.studentId ? ` · Student ID: ${escapeHtml(user.profile.studentId)}` : ''}
            </p>
          </div>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div>
            <h2 class="text-base font-bold text-slate-900">University identity verification</h2>
            <p class="text-sm text-slate-600 mt-1">Upload a clear photo or PDF of your official Almaarefa University Student ID card.</p>
          </div>
          ${
            user.isVerified || state.verificationSubmitted
              ? `
            <div class="p-4 rounded-xl border text-sm flex items-start gap-2.5 bg-emerald-50 border-emerald-200 text-emerald-900">
              <i data-lucide="check-circle-2" class="w-5 h-5 text-emerald-600 shrink-0"></i>
              <div>
                <strong>${user.isVerified ? 'Your student identity is verified.' : 'Verification submitted — pending review'}</strong>
                <p class="mt-0.5 text-xs">You have full access to post, join course communities, and RSVP to campus events.</p>
              </div>
            </div>
          `
              : `
            <div class="space-y-3">
              <label for="student-id-file" class="block border-2 border-dashed border-slate-300 hover:border-brand-500 rounded-2xl p-6 text-center cursor-pointer transition-colors">
                <i data-lucide="upload-cloud" class="w-8 h-8 text-slate-500 mx-auto mb-2"></i>
                <span class="block text-sm font-semibold text-slate-800">
                  ${state.idFile ? escapeHtml(state.idFile.name) : 'Choose your Student ID photo or PDF'}
                </span>
                <span class="block text-xs text-slate-600 mt-1">JPG, PNG, or PDF · Max 5 MB</span>
                <input id="student-id-file" type="file" accept=".jpg,.jpeg,.png,.pdf" class="sr-only" />
              </label>
              <button type="button" id="submit-id-btn" class="bg-brand-700 hover:bg-brand-800 text-[#ffffff] text-sm font-semibold px-4 min-h-11 rounded-xl transition-colors cursor-pointer">
                Submit for verification
              </button>
            </div>
          `
          }
        </div>
      </div>
    `;
  }

  function renderAdminSection() {
    return `
      <div class="space-y-5">
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex items-center justify-between gap-4">
          <div>
            <span class="text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">Admin only</span>
            <h1 class="text-xl font-bold text-slate-900 mt-2">Content Moderation & Governance</h1>
            <p class="text-sm text-slate-600 mt-0.5">Review flagged posts, approve club requests, and inspect audit logs.</p>
          </div>
          <i data-lucide="shield-alert" class="w-10 h-10 text-brand-700 hidden sm:block"></i>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 class="text-sm font-bold text-slate-900 mb-3">
            Pending content reports
            <span class="ms-1 text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">${state.reportResolved ? 0 : 1}</span>
          </h2>
          ${
            state.reportResolved
              ? `<p class="text-sm text-slate-600 py-6 text-center">All caught up — no pending reports to review.</p>`
              : `
            <div class="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span class="text-[11px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">Reason: Spam</span>
                <p class="text-sm font-semibold text-slate-900 mt-1.5">“Unauthorized commercial advertising link posted in general feed.”</p>
                <p class="text-[11px] text-slate-500 mt-0.5">Report ID: 8b5f3a1e-8422-4876-b333-e0283fc37a11</p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <button type="button" id="admin-delete-post" class="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-[#ffffff] text-xs font-semibold px-3 min-h-9 rounded-lg cursor-pointer">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                  <span>Delete post</span>
                </button>
                <button type="button" id="admin-dismiss-report" class="bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold px-3 min-h-9 rounded-lg cursor-pointer">
                  Dismiss
                </button>
              </div>
            </div>
          `
          }
        </div>
      </div>
    `;
  }

  // Event Delegation
  document.addEventListener('click', (e) => {
    const navBtn = e.target.closest('[data-nav-section]');
    if (navBtn) {
      state.activeSection = navBtn.getAttribute('data-nav-section');
      renderShell();
      return;
    }

    const filterBtn = e.target.closest('[data-feed-filter]');
    if (filterBtn) {
      state.feedFilter = filterBtn.getAttribute('data-feed-filter');
      renderShell();
      return;
    }

    const likeBtn = e.target.closest('[data-like-post]');
    if (likeBtn) {
      const id = likeBtn.getAttribute('data-like-post');
      state.posts = state.posts.map((p) =>
        p.postId === id
          ? {
              ...p,
              stats: {
                ...p.stats,
                hasLiked: !p.stats.hasLiked,
                likesCount: p.stats.likesCount + (!p.stats.hasLiked ? 1 : -1),
              },
            }
          : p
      );
      renderShell();
      return;
    }

    const reportBtn = e.target.closest('[data-report-post]');
    if (reportBtn) {
      state.reportedPostIds.add(reportBtn.getAttribute('data-report-post'));
      showToast('Thanks — a moderator will review this post.');
      renderShell();
      return;
    }

    const groupBtn = e.target.closest('[data-toggle-group]');
    if (groupBtn) {
      const id = groupBtn.getAttribute('data-toggle-group');
      state.classGroups = state.classGroups.map((g) => {
        if (g.groupId !== id) return g;
        const next = !g.isMember;
        showToast(next ? `Joined ${g.courseCode} class group.` : `Left ${g.courseCode}.`);
        return { ...g, isMember: next, membersCount: g.membersCount + (next ? 1 : -1) };
      });
      renderShell();
      return;
    }

    const clubBtn = e.target.closest('[data-toggle-club]');
    if (clubBtn) {
      const id = clubBtn.getAttribute('data-toggle-club');
      state.clubs = state.clubs.map((c) => {
        if (c.clubId !== id) return c;
        const next = !c.isFollowing;
        showToast(next ? `Now following ${c.name}.` : `Unfollowed ${c.name}.`);
        return { ...c, isFollowing: next, membersCount: c.membersCount + (next ? 1 : -1) };
      });
      renderShell();
      return;
    }

    const eventBtn = e.target.closest('[data-toggle-event]');
    if (eventBtn) {
      const id = eventBtn.getAttribute('data-toggle-event');
      state.events = state.events.map((ev) => {
        if (ev.eventId !== id) return ev;
        const next = !ev.hasRsvp;
        showToast(next ? `You're going to "${ev.title}".` : `RSVP for "${ev.title}" canceled.`);
        return { ...ev, hasRsvp: next, rsvpCount: ev.rsvpCount + (next ? 1 : -1) };
      });
      renderShell();
      return;
    }

    const toastBtn = e.target.closest('[data-toast]');
    if (toastBtn) {
      showToast(toastBtn.getAttribute('data-toast'));
      return;
    }

    if (e.target.closest('#logout-btn')) {
      window.AuthService.logout();
      return;
    }

    if (e.target.closest('#submit-id-btn')) {
      state.verificationSubmitted = true;
      showToast('Student ID submitted for review.');
      renderShell();
      return;
    }

    if (e.target.closest('#admin-delete-post') || e.target.closest('#admin-dismiss-report')) {
      state.reportResolved = true;
      showToast('Moderation action recorded.');
      renderShell();
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target.id === 'persona-switcher') {
      const updated = window.AuthService.switchMockPersona(e.target.value);
      if (updated) {
        state.user = updated;
        showToast(`Switched role to ${updated.profile.fullName}`);
        renderShell();
      }
    }
    if (e.target.id === 'student-id-file') {
      state.idFile = e.target.files?.[0] || null;
      renderShell();
    }
  });

  document.addEventListener('submit', (e) => {
    if (e.target.id === 'post-composer-form') {
      e.preventDefault();
      const input = document.getElementById('post-composer-input');
      const typeSelect = document.getElementById('post-type-select');
      const content = (input?.value || '').trim();
      if (!content) return;

      const created = {
        postId: 'post-' + Date.now(),
        author: {
          userId: state.user.userId,
          fullName: state.user.profile.fullName,
          username: state.user.profile.username,
          avatarUrl: null,
          isVerified: state.user.isVerified,
          departmentName: state.user.profile.departmentName || 'Almaarefa University',
        },
        postType: typeSelect?.value || 'ACADEMIC',
        content,
        attachments: [],
        stats: { likesCount: 0, commentsCount: 0, hasLiked: false },
        moderationStatus: 'APPROVED',
        createdAt: new Date().toISOString(),
      };
      state.posts = [created, ...state.posts];
      state.newPostContent = '';
      showToast('Your post is live on the campus feed.');
      renderShell();
    }
  });

  document.addEventListener('DOMContentLoaded', renderShell);
})();