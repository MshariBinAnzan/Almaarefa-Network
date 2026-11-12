'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  Download,
  FileText,
  Flag,
  Heart,
  Inbox,
  Loader2,
  MapPin,
  MessageSquare,
  Paperclip,
  Plus,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UploadCloud,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { AppShell } from '@/components/layout/AppShell';
import {
  MOCK_CLASS_GROUPS,
  MOCK_CLUBS,
  MOCK_EVENTS,
  MOCK_POSTS,
} from '@/mocks/data';
import { CampusEvent, ClassGroup, Club, Post } from '@/types';
import { cn } from '@/utils/validators';

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

type Section = 'feed' | 'courses' | 'clubs' | 'calendar' | 'profile' | 'admin';
type FeedFilter = 'ALL' | Post['postType'];

const SECTIONS: Section[] = ['feed', 'courses', 'clubs', 'calendar', 'profile', 'admin'];
const MAX_POST_LENGTH = 2000;
const MAX_ID_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_ID_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

/** Shared keyboard focus style (WCAG 2.4.7 – visible focus). */
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2';

const FEED_TABS: { id: FeedFilter; label: string; shortLabel: string }[] = [
  { id: 'ALL', label: 'All Activity', shortLabel: 'All' },
  { id: 'ACADEMIC', label: 'Course Discussions', shortLabel: 'Courses' },
  { id: 'CLUB_EVENT', label: 'Club Announcements', shortLabel: 'Clubs' },
  { id: 'GENERAL', label: 'Campus Updates', shortLabel: 'Campus' },
];

const POST_TYPE_META: Record<Post['postType'], { label: string; className: string }> = {
  ACADEMIC: { label: 'Course Q&A', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  CLUB_EVENT: { label: 'Club Activity', className: 'bg-teal-50 text-teal-700 border-teal-200' },
  GENERAL: { label: 'Campus Update', className: 'bg-slate-100 text-slate-700 border-slate-200' },
};

function getInitials(fullName: string) {
  return fullName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatEventDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function isSection(value: string | null): value is Section {
  return !!value && (SECTIONS as string[]).includes(value);
}

/* -------------------------------------------------------------------------- */
/*                              Small UI building blocks                      */
/* -------------------------------------------------------------------------- */

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('bg-white rounded-2xl border border-slate-200 shadow-sm', className)}>
      {children}
    </div>
  );
}

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-600 mt-1">{description}</p>
      </div>
      {action}
    </Card>
  );
}

function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-10 px-6 rounded-2xl border border-dashed border-slate-300 bg-white">
      <Icon className="w-8 h-8 text-slate-400 mx-auto" aria-hidden="true" />
      <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-xs text-slate-600">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/**
 * Two-state action button (Join / Follow / RSVP).
 * Exposes state via aria-pressed and uses an icon + text, so state is
 * never communicated by color alone.
 */
function ToggleButton({
  active,
  onClick,
  activeLabel,
  inactiveLabel,
  ariaLabel,
  variant = 'brand',
  size = 'sm',
}: {
  active: boolean;
  onClick: () => void;
  activeLabel: string;
  inactiveLabel: string;
  ariaLabel?: string;
  variant?: 'brand' | 'dark';
  size?: 'sm' | 'md';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 font-semibold rounded-xl border transition-colors duration-200 shrink-0 cursor-pointer',
        focusRing,
        size === 'sm'
          ? 'text-xs px-3 min-h-11 sm:min-h-9'
          : 'text-sm px-4 min-h-11',
        active
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
          : 'bg-brand-700 text-[#ffffff] border-brand-700 hover:bg-brand-800'
      )}
    >
      {active && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
      <span>{active ? activeLabel : inactiveLabel}</span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Dashboard                                 */
/* -------------------------------------------------------------------------- */

export default function DashboardPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  const [activeSection, setActiveSection] = useState<Section>('feed');
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('ALL');
  const [posts, setPosts] = useState<Post[]>(MOCK_POSTS);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>(MOCK_CLASS_GROUPS);
  const [clubs, setClubs] = useState<Club[]>(MOCK_CLUBS);
  const [events, setEvents] = useState<CampusEvent[]>(MOCK_EVENTS);
  const [reportedPostIds, setReportedPostIds] = useState<Set<string>>(new Set());

  // Post composer
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostType, setNewPostType] = useState<'GENERAL' | 'ACADEMIC'>('ACADEMIC');

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Verification upload
  const [verificationSubmitted, setVerificationSubmitted] = useState(false);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idFileError, setIdFileError] = useState<string | null>(null);

  // Admin moderation (mock single report)
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [reportResolved, setReportResolved] = useState(false);

  /* ------------------------------ Effects ------------------------------ */

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Deep linking: restore the section from ?tab= on first load.
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (isSection(tab)) setActiveSection(tab);
  }, []);

  // Never leave a non-admin on a blank admin view (e.g. after switching persona).
  useEffect(() => {
    if (activeSection === 'admin' && user && user.role !== 'ADMIN') {
      setActiveSection('feed');
    }
  }, [activeSection, user]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMessage(msg);
    toastTimer.current = setTimeout(() => setToastMessage(null), 4000);
  }, []);

  const selectSection = useCallback((section: string) => {
    if (!isSection(section)) return;
    setActiveSection(section);
    window.history.replaceState(null, '', section === 'feed' ? '/' : `/?tab=${section}`);
    window.scrollTo({ top: 0 });
  }, []);

  if (isLoading || !user) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-600 gap-3"
      >
        <Loader2 className="w-7 h-7 motion-safe:animate-spin text-brand-700" aria-hidden="true" />
        <p className="text-sm font-medium">Loading Almaarefa Network…</p>
      </div>
    );
  }

  /* ------------------------------ Handlers ----------------------------- */

  const firstName = user.profile.fullName.split(' ')[0];

  const handleCreatePost = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user.isVerified) {
      showToast('Verify your Student ID before publishing posts.');
      return;
    }
    const content = newPostContent.trim();
    if (!content) return;

    const created: Post = {
      postId: 'post-' + Date.now(),
      author: {
        userId: user.userId,
        fullName: user.profile.fullName,
        username: user.profile.username,
        avatarUrl: user.profile.avatarUrl,
        isVerified: user.isVerified,
        departmentName: user.profile.departmentName || 'Almaarefa University',
      },
      postType: newPostType,
      content,
      attachments: [],
      stats: { likesCount: 0, commentsCount: 0, hasLiked: false },
      moderationStatus: 'APPROVED',
      createdAt: new Date().toISOString(),
    };

    setPosts((prev) => [created, ...prev]);
    setNewPostContent('');
    // Make sure the user can actually see what they just published.
    if (feedFilter !== 'ALL' && feedFilter !== newPostType) setFeedFilter('ALL');
    showToast('Your post is live on the campus feed.');
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleCreatePost();
  };

  const handleToggleLike = (postId: string) => {
    setPosts((prev) =>
      prev.map((post) => {
        if (post.postId !== postId) return post;
        const hasLiked = !post.stats.hasLiked;
        return {
          ...post,
          stats: {
            ...post.stats,
            hasLiked,
            likesCount: post.stats.likesCount + (hasLiked ? 1 : -1),
          },
        };
      })
    );
  };

  const handleReport = (postId: string) => {
    setReportedPostIds((prev) => new Set(prev).add(postId));
    showToast('Thanks — a moderator will review this post.');
  };

  // Side effects (toasts) are kept out of state updaters so they fire exactly once.
  const handleToggleGroupJoin = (group: ClassGroup) => {
    const isMember = !group.isMember;
    setClassGroups((prev) =>
      prev.map((g) =>
        g.groupId === group.groupId
          ? { ...g, isMember, membersCount: (g.membersCount || 0) + (isMember ? 1 : -1) }
          : g
      )
    );
    showToast(isMember ? `Joined ${group.courseCode} class group.` : `Left ${group.courseCode}.`);
  };

  const handleToggleClubFollow = (club: Club) => {
    const isFollowing = !club.isFollowing;
    setClubs((prev) =>
      prev.map((c) =>
        c.clubId === club.clubId
          ? { ...c, isFollowing, membersCount: (c.membersCount || 0) + (isFollowing ? 1 : -1) }
          : c
      )
    );
    showToast(isFollowing ? `Now following ${club.name}.` : `Unfollowed ${club.name}.`);
  };

  const handleToggleRsvp = (ev: CampusEvent) => {
    const hasRsvp = !ev.hasRsvp;
    setEvents((prev) =>
      prev.map((e) =>
        e.eventId === ev.eventId
          ? { ...e, hasRsvp, rsvpCount: e.rsvpCount + (hasRsvp ? 1 : -1) }
          : e
      )
    );
    showToast(hasRsvp ? `You're going to "${ev.title}".` : `RSVP for "${ev.title}" canceled.`);
  };

  const handleIdFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setIdFileError(null);
    if (!file) {
      setIdFile(null);
      return;
    }
    if (!ACCEPTED_ID_TYPES.includes(file.type)) {
      setIdFile(null);
      setIdFileError('Unsupported file type. Please upload a JPG, PNG, or PDF.');
      return;
    }
    if (file.size > MAX_ID_FILE_BYTES) {
      setIdFile(null);
      setIdFileError('File is larger than 5 MB. Please upload a smaller file.');
      return;
    }
    setIdFile(file);
  };

  const handleSubmitVerification = () => {
    if (!idFile) {
      setIdFileError('Please choose a photo or PDF of your Student ID first.');
      return;
    }
    setVerificationSubmitted(true);
    showToast('Student ID submitted for review.');
  };

  const filteredPosts = posts.filter((p) => feedFilter === 'ALL' || p.postType === feedFilter);
  const upcomingEvents = [...events].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  /* ------------------------------- Render ------------------------------ */

  return (
    <AppShell activeTab={activeSection} onSelectSection={selectSection}>
      {/* Toast — announced to screen readers, dismissible, auto-hides after 4s */}
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-20 md:bottom-6 end-4 sm:end-6 z-50 pointer-events-none"
      >
        {toastMessage && (
          <div className="pointer-events-auto max-w-sm bg-[#0f172a] text-[#f8fafc] ps-4 pe-2 py-2 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 border border-[#334155]">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
            <span className="flex-1">{toastMessage}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              aria-label="Dismiss notification"
              className={cn(
                'p-2 rounded-lg text-[#cbd5e1] hover:text-[#ffffff] hover:bg-[#1e293b] transition-colors cursor-pointer',
                focusRing
              )}
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {/* SECTION 1: MAIN CAMPUS FEED */}
      {activeSection === 'feed' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <h1 className="sr-only">Campus Feed</h1>

          <div className="lg:col-span-8 space-y-5">
            {/* Post Composer */}
            <Card className="p-4 sm:p-5">
              {user.isVerified ? (
                <form onSubmit={handleCreatePost}>
                  <div className="flex items-start gap-3">
                    <div
                      aria-hidden="true"
                      className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center text-sm shrink-0"
                    >
                      {getInitials(user.profile.fullName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <label htmlFor="post-composer" className="sr-only">
                        Write a post
                      </label>
                      <textarea
                        id="post-composer"
                        rows={3}
                        maxLength={MAX_POST_LENGTH}
                        value={newPostContent}
                        onChange={(e) => setNewPostContent(e.target.value)}
                        onKeyDown={handleComposerKeyDown}
                        aria-describedby="post-composer-hint"
                        placeholder={`Ask a course question or share an update, ${firstName}…`}
                        className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl p-3 focus:bg-white focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 resize-y transition-colors"
                      />
                      <p
                        id="post-composer-hint"
                        className="mt-1 flex justify-between text-[11px] text-slate-500"
                      >
                        <span className="hidden sm:inline">Press Ctrl + Enter to publish</span>
                        <span className="ms-auto tabular-nums">
                          {newPostContent.length}/{MAX_POST_LENGTH}
                        </span>
                      </p>

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <label htmlFor="post-type" className="sr-only">
                            Post type
                          </label>
                          <select
                            id="post-type"
                            value={newPostType}
                            onChange={(e) =>
                              setNewPostType(e.target.value as 'GENERAL' | 'ACADEMIC')
                            }
                            className={cn(
                              'text-xs bg-slate-100 border border-slate-200 rounded-lg px-2.5 min-h-11 sm:min-h-9 font-medium text-slate-700 cursor-pointer',
                              focusRing
                            )}
                          >
                            <option value="ACADEMIC">Academic / Course Q&amp;A</option>
                            <option value="GENERAL">General Campus Discussion</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => showToast('File attachments are coming soon.')}
                            className={cn(
                              'inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-brand-700 px-2.5 min-h-11 sm:min-h-9 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer',
                              focusRing
                            )}
                          >
                            <Paperclip className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Attach file</span>
                          </button>
                        </div>

                        <button
                          type="submit"
                          disabled={!newPostContent.trim()}
                          className={cn(
                            'inline-flex items-center gap-1.5 bg-brand-700 hover:bg-brand-800 disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed text-[#ffffff] text-sm font-semibold px-4 min-h-11 sm:min-h-10 rounded-xl transition-colors shadow-sm cursor-pointer',
                            focusRing
                          )}
                        >
                          <Send className="w-4 h-4" aria-hidden="true" />
                          <span>Publish</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              ) : (
                /* Locked composer: explain why and offer the fix, instead of a disabled field */
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <ShieldCheck className="w-8 h-8 text-amber-600 shrink-0" aria-hidden="true" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">
                      Verify your Student ID to start posting
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      You can read every feed now. Posting unlocks once Student Affairs confirms
                      your ID.
                    </p>
                  </div>
                    <button
                      type="button"
                      onClick={() => selectSection('profile')}
                      className={cn(
                        'bg-brand-700 hover:bg-brand-800 text-[#ffffff] text-sm font-semibold px-4 min-h-11 rounded-xl transition-colors shrink-0 cursor-pointer',
                        focusRing
                      )}
                    >
                      Verify Student ID
                    </button>
                </div>
              )}
            </Card>

            {/* Feed Filter Tabs */}
            <div
              role="tablist"
              aria-label="Filter feed"
              className="flex items-center gap-1 overflow-x-auto bg-white rounded-xl p-1.5 border border-slate-200 shadow-sm"
            >
              {FEED_TABS.map((tab) => {
                const selected = feedFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls="feed-panel"
                    onClick={() => setFeedFilter(tab.id)}
                    className={cn(
                      'flex-1 whitespace-nowrap min-h-11 sm:min-h-9 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                      focusRing,
                      selected
                        ? 'bg-brand-700 text-[#ffffff] shadow-sm'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    )}
                  >
                    <span className="sm:hidden">{tab.shortLabel}</span>
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Posts List */}
            <div id="feed-panel" role="tabpanel" className="space-y-4">
              {filteredPosts.length === 0 ? (
                <EmptyState
                  title="Nothing here yet"
                  description="No posts match this filter. Try another tab or start the conversation."
                  action={
                    <button
                      type="button"
                      onClick={() => setFeedFilter('ALL')}
                      className={cn(
                        'text-sm font-semibold text-brand-700 hover:underline cursor-pointer rounded',
                        focusRing
                      )}
                    >
                      Show all activity
                    </button>
                  }
                />
              ) : (
                filteredPosts.map((post) => {
                  const typeMeta = POST_TYPE_META[post.postType];
                  const isReported = reportedPostIds.has(post.postId);
                  return (
                    <Card key={post.postId} className="p-5">
                      <article className="space-y-3.5" aria-labelledby={`author-${post.postId}`}>
                        <header className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              aria-hidden="true"
                              className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-sm border border-slate-200 shrink-0"
                            >
                              {getInitials(post.author.fullName)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-x-1.5">
                                <h2
                                  id={`author-${post.postId}`}
                                  className="text-sm font-bold text-slate-900"
                                >
                                  {post.author.fullName}
                                </h2>
                                {post.author.isVerified && (
                                  <CheckCircle2
                                    className="w-4 h-4 text-brand-600"
                                    aria-label="Verified student"
                                    role="img"
                                  />
                                )}
                                <span className="text-xs text-slate-500 truncate">
                                  @{post.author.username}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500">
                                {post.author.departmentName || 'Almaarefa University'} ·{' '}
                                <time dateTime={post.createdAt}>
                                  {formatShortDate(post.createdAt)}
                                </time>
                              </p>
                            </div>
                          </div>

                          <span
                            className={cn(
                              'text-[11px] font-semibold px-2.5 py-1 rounded-full border shrink-0',
                              typeMeta.className
                            )}
                          >
                            {typeMeta.label}
                          </span>
                        </header>

                        <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line break-words">
                          {post.content}
                        </p>

                        {/* Attachments */}
                        {post.attachments && post.attachments.length > 0 && (
                          <ul className="space-y-2 pt-1">
                            {post.attachments.map((att) => (
                              <li
                                key={att.url}
                                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <FileText
                                    className="w-5 h-5 text-brand-600 shrink-0"
                                    aria-hidden="true"
                                  />
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold text-slate-900 truncate">
                                      {att.name}
                                    </div>
                                    {att.sizeBytes && (
                                      <div className="text-[11px] text-slate-500">
                                        {(att.sizeBytes / 1024).toFixed(0)} KB
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => showToast(`Downloading ${att.name}…`)}
                                  aria-label={`Download ${att.name}`}
                                  className={cn(
                                    'inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 px-3 min-h-11 sm:min-h-9 rounded-lg transition-colors shrink-0 cursor-pointer',
                                    focusRing
                                  )}
                                >
                                  <Download className="w-4 h-4" aria-hidden="true" />
                                  <span className="hidden sm:inline">Download</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}

                        {/* Post Footer Actions */}
                        <footer className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-600">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleLike(post.postId)}
                              aria-pressed={post.stats.hasLiked}
                              className={cn(
                                'inline-flex items-center gap-1.5 font-medium px-2.5 min-h-11 sm:min-h-9 rounded-lg transition-colors cursor-pointer',
                                focusRing,
                                post.stats.hasLiked
                                  ? 'text-rose-600 font-semibold hover:bg-rose-50'
                                  : 'hover:text-slate-900 hover:bg-slate-100'
                              )}
                            >
                              <Heart
                                className={cn('w-4 h-4', post.stats.hasLiked && 'fill-rose-600')}
                                aria-hidden="true"
                              />
                              <span>{pluralize(post.stats.likesCount, 'Like')}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => showToast('Replies are coming soon.')}
                              className={cn(
                                'inline-flex items-center gap-1.5 font-medium px-2.5 min-h-11 sm:min-h-9 rounded-lg hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer',
                                focusRing
                              )}
                            >
                              <MessageSquare className="w-4 h-4" aria-hidden="true" />
                              <span>{pluralize(post.stats.commentsCount, 'Reply', 'Replies')}</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleReport(post.postId)}
                            disabled={isReported}
                            aria-label={isReported ? 'Post reported' : 'Report this post'}
                            className={cn(
                              'inline-flex items-center gap-1.5 px-2.5 min-h-11 sm:min-h-9 rounded-lg transition-colors cursor-pointer disabled:cursor-default',
                              focusRing,
                              isReported
                                ? 'text-slate-500'
                                : 'text-slate-500 hover:text-red-700 hover:bg-red-50'
                            )}
                          >
                            <Flag
                              className={cn('w-3.5 h-3.5', isReported && 'fill-slate-400')}
                              aria-hidden="true"
                            />
                            <span className="hidden sm:inline">
                              {isReported ? 'Reported' : 'Report'}
                            </span>
                          </button>
                        </footer>
                      </article>
                    </Card>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column Widgets */}
          <aside className="lg:col-span-4 space-y-6" aria-label="Your courses and upcoming events">
            {/* Course Groups Widget */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3.5">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-brand-600" aria-hidden="true" />
                  <span>Official Course Groups</span>
                </h2>
                <button
                  type="button"
                  onClick={() => selectSection('courses')}
                  className={cn(
                    'text-xs font-semibold text-brand-700 hover:underline rounded cursor-pointer',
                    focusRing
                  )}
                >
                  View all
                </button>
              </div>
              {classGroups.length === 0 ? (
                <p className="text-xs text-slate-600">No course groups available this semester.</p>
              ) : (
                <ul className="space-y-3">
                  {classGroups.map((group) => (
                    <li
                      key={group.groupId}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded">
                          {group.courseCode}
                        </span>
                        <h3 className="text-xs font-semibold text-slate-900 mt-1">
                          {group.courseName}
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          {group.semester} · {pluralize(group.membersCount || 0, 'student')}
                        </p>
                      </div>
                      <ToggleButton
                        active={!!group.isMember}
                        onClick={() => handleToggleGroupJoin(group)}
                        activeLabel="Joined"
                        inactiveLabel="Join"
                        ariaLabel={`${group.isMember ? 'Leave' : 'Join'} ${group.courseCode}`}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Upcoming Events Widget */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3.5">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-brand-600" aria-hidden="true" />
                  <span>Upcoming Campus Events</span>
                </h2>
                <button
                  type="button"
                  onClick={() => selectSection('calendar')}
                  className={cn(
                    'text-xs font-semibold text-brand-700 hover:underline rounded cursor-pointer',
                    focusRing
                  )}
                >
                  View calendar
                </button>
              </div>
              {upcomingEvents.length === 0 ? (
                <p className="text-xs text-slate-600">No upcoming events. Check back soon.</p>
              ) : (
                <ul className="space-y-3">
                  {upcomingEvents.slice(0, 3).map((ev) => (
                    <li key={ev.eventId} className="p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                      <div className="text-[11px] font-semibold text-brand-700">{ev.club.name}</div>
                      <h3 className="text-xs font-bold text-slate-900">{ev.title}</h3>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                        <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                        <time dateTime={ev.startTime}>{formatEventDate(ev.startTime)}</time>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                        <span>{ev.location}</span>
                      </div>
                      <div className="pt-1.5 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-500">
                          {pluralize(ev.rsvpCount, 'student')} going
                        </span>
                        <ToggleButton
                          active={ev.hasRsvp}
                          onClick={() => handleToggleRsvp(ev)}
                          activeLabel="Going"
                          inactiveLabel="RSVP"
                          ariaLabel={`${ev.hasRsvp ? 'Cancel RSVP for' : 'RSVP to'} ${ev.title}`}
                          variant="dark"
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </aside>
        </div>
      )}

      {/* SECTION 2: OFFICIAL COURSE COMMUNITIES */}
      {activeSection === 'courses' && (
        <div className="space-y-5">
          <SectionHeader
            title="Official Course Communities"
            description="Class groups linked to the Almaarefa University academic catalog for this semester."
          />

          {classGroups.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No course groups yet"
              description="Course groups appear here once your registrar enrollment syncs."
            />
          ) : (
            <ul className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {classGroups.map((group) => (
                <li key={group.groupId}>
                  <Card className="h-full p-5 flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-brand-50 text-brand-700">
                          {group.courseCode}
                        </span>
                        <span className="text-xs text-slate-500">{group.semester}</span>
                      </div>
                      <h2 className="text-base font-bold text-slate-900 mt-2">{group.title}</h2>
                      {group.description && (
                        <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                          {group.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-slate-600">
                        <strong className="text-slate-900">{group.membersCount || 0}</strong>{' '}
                        verified students enrolled
                      </span>
                      <ToggleButton
                        active={!!group.isMember}
                        onClick={() => handleToggleGroupJoin(group)}
                        activeLabel="Joined"
                        inactiveLabel="Join class group"
                        ariaLabel={`${group.isMember ? 'Leave' : 'Join'} ${group.courseCode} class group`}
                        size="md"
                      />
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* SECTION 3: STUDENT CLUBS */}
      {activeSection === 'clubs' && (
        <div className="space-y-5">
          <SectionHeader
            title="Recognized Student Clubs"
            description="Follow official clubs, join committees, or propose a new student organization."
            action={
              <button
                type="button"
                onClick={() => showToast('Club proposals are coming soon.')}
                className={cn(
                  'inline-flex items-center justify-center gap-1.5 bg-brand-700 hover:bg-brand-800 text-[#ffffff] text-sm font-semibold px-4 min-h-11 rounded-xl transition-colors shrink-0 cursor-pointer',
                  focusRing
                )}
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                Propose new club
              </button>
            }
          />

          {clubs.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No clubs yet"
              description="Be the first to propose a student club."
            />
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {clubs.map((club) => (
                <li key={club.clubId}>
                  <Card className="h-full p-5 flex flex-col justify-between gap-4">
                    <div>
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {club.category}
                      </span>
                      <h2 className="text-base font-bold text-slate-900 mt-2">{club.name}</h2>
                      {club.description && (
                        <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                          {club.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-slate-600">
                        {pluralize(club.membersCount || 0, 'member')}
                      </span>
                      <ToggleButton
                        active={!!club.isFollowing}
                        onClick={() => handleToggleClubFollow(club)}
                        activeLabel="Following"
                        inactiveLabel="Follow"
                        ariaLabel={`${club.isFollowing ? 'Unfollow' : 'Follow'} ${club.name}`}
                      />
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* SECTION 4: UNIFIED CAMPUS EVENT CALENDAR */}
      {activeSection === 'calendar' && (
        <div className="space-y-5">
          <SectionHeader
            title="Campus Event Calendar"
            description="Every upcoming Almaarefa University workshop, club activity, and seminar in one place."
          />

          {upcomingEvents.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No upcoming events"
              description="Follow clubs to hear about new events first."
              action={
                <button
                  type="button"
                  onClick={() => selectSection('clubs')}
                  className={cn(
                    'text-sm font-semibold text-brand-700 hover:underline rounded cursor-pointer',
                    focusRing
                  )}
                >
                  Browse clubs
                </button>
              }
            />
          ) : (
            <ul className="space-y-4">
              {upcomingEvents.map((ev) => (
                <li key={ev.eventId}>
                  <Card className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5 min-w-0">
                      <span className="text-xs font-bold text-brand-700">{ev.club.name}</span>
                      <h2 className="text-base font-bold text-slate-900">{ev.title}</h2>
                      <p className="text-sm text-slate-600">{ev.description}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-slate-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                          <time dateTime={ev.startTime}>{formatEventDate(ev.startTime)}</time>
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                          {ev.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                          {ev.rsvpCount} going
                        </span>
                      </div>
                    </div>

                    <ToggleButton
                      active={ev.hasRsvp}
                      onClick={() => handleToggleRsvp(ev)}
                      activeLabel="Going"
                      inactiveLabel="RSVP"
                      ariaLabel={`${ev.hasRsvp ? 'Cancel RSVP for' : 'RSVP to'} ${ev.title}`}
                      size="md"
                    />
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* SECTION 5: STUDENT PROFILE & ID VERIFICATION */}
      {activeSection === 'profile' && (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div
                aria-hidden="true"
                className="w-16 h-16 rounded-2xl bg-brand-100 text-brand-700 font-bold text-xl flex items-center justify-center border border-brand-200 shrink-0"
              >
                {getInitials(user.profile.fullName)}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold text-slate-900">{user.profile.fullName}</h1>
                  {user.isVerified ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      Verified Student
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full">
                      Verification pending
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-600 mt-0.5 break-all">
                  @{user.profile.username} · {user.universityEmail}
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  Department:{' '}
                  <strong className="text-slate-900">
                    {user.profile.departmentName || 'Computer Science'}
                  </strong>
                  {user.profile.studentId && ` · Student ID: ${user.profile.studentId}`}
                </p>
              </div>
            </div>
          </Card>

          {/* Student ID Verification */}
          <Card className="p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">University identity verification</h2>
              <p className="text-sm text-slate-600 mt-1">
                Upload a clear photo or PDF of your official Almaarefa University Student ID card.
              </p>
            </div>

            {verificationSubmitted || user.isVerified ? (
              <div
                className={cn(
                  'p-4 rounded-xl border text-sm flex items-start gap-2.5',
                  user.isVerified
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-blue-50 border-blue-200 text-blue-900'
                )}
              >
                <CheckCircle2
                  className={cn(
                    'w-5 h-5 shrink-0',
                    user.isVerified ? 'text-emerald-600' : 'text-blue-600'
                  )}
                  aria-hidden="true"
                />
                <div>
                  <strong>
                    {user.isVerified
                      ? 'Your student identity is verified.'
                      : 'Verification submitted — pending review'}
                  </strong>
                  <p className="mt-0.5 text-xs">
                    {user.isVerified
                      ? 'You have full access to post, join course communities, and RSVP to campus events.'
                      : 'Student Affairs usually reviews IDs within 1–2 business days. We’ll notify you when it’s done.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Real, keyboard-accessible file picker styled as a dropzone */}
                <label
                  htmlFor="student-id-file"
                  className={cn(
                    'block border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors',
                    'focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-2',
                    idFileError
                      ? 'border-red-300 bg-red-50/50'
                      : idFile
                      ? 'border-emerald-300 bg-emerald-50/50'
                      : 'border-slate-300 hover:border-brand-500 hover:bg-brand-50/40'
                  )}
                >
                  <UploadCloud className="w-8 h-8 text-slate-500 mx-auto mb-2" aria-hidden="true" />
                  <span className="block text-sm font-semibold text-slate-800">
                    {idFile ? idFile.name : 'Choose your Student ID photo or PDF'}
                  </span>
                  <span className="block text-xs text-slate-600 mt-1">
                    {idFile
                      ? `${(idFile.size / 1024).toFixed(0)} KB · Click to choose a different file`
                      : 'JPG, PNG, or PDF · Max 5 MB'}
                  </span>
                  <input
                    id="student-id-file"
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                    onChange={handleIdFileChange}
                    aria-describedby={idFileError ? 'student-id-error' : undefined}
                    aria-invalid={!!idFileError}
                    className="sr-only"
                  />
                </label>

                {idFileError && (
                  <p id="student-id-error" role="alert" className="text-xs font-medium text-red-700">
                    {idFileError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleSubmitVerification}
                  disabled={!idFile}
                  className={cn(
                    'bg-brand-700 hover:bg-brand-800 disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed text-[#ffffff] text-sm font-semibold px-4 min-h-11 rounded-xl transition-colors cursor-pointer',
                    focusRing
                  )}
                >
                  Submit for verification
                </button>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* SECTION 6: ADMIN MODERATION PANEL (Role-Guarded) */}
      {activeSection === 'admin' && user.role === 'ADMIN' && (
        <div className="space-y-5">
          <Card className="p-6 flex items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
                Admin only
              </span>
              <h1 className="text-xl font-bold text-slate-900 mt-2">
                Content Moderation &amp; Governance
              </h1>
              <p className="text-sm text-slate-600 mt-0.5">
                Review flagged posts, approve club requests, and inspect audit logs.
              </p>
            </div>
            <ShieldAlert className="w-10 h-10 text-brand-700 hidden sm:block" aria-hidden="true" />
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-bold text-slate-900 mb-3">
              Pending content reports{' '}
              <span className="ms-1 text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                {reportResolved ? 0 : 1}
              </span>
            </h2>

            {reportResolved ? (
              <EmptyState
                icon={CheckCircle2}
                title="All caught up"
                description="There are no pending reports to review."
              />
            ) : (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="min-w-0">
                  <span className="text-[11px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                    Reason: Spam
                  </span>
                  <p className="text-sm font-semibold text-slate-900 mt-1.5">
                    &ldquo;Unauthorized commercial advertising link posted in general feed.&rdquo;
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 break-all">
                    Report ID: 8b5f3a1e-8422-4876-b333-e0283fc37a11
                  </p>
                </div>

                {confirmingDelete ? (
                  /* Destructive action requires explicit confirmation */
                  <div
                    role="group"
                    aria-label="Confirm deletion"
                    className="flex flex-wrap items-center gap-2 shrink-0"
                  >
                    <span className="text-xs font-medium text-red-700">Delete permanently?</span>
                    <button
                      type="button"
                      autoFocus
                      onClick={() => {
                        setConfirmingDelete(false);
                        setReportResolved(true);
                        showToast('Post deleted and logged to the audit trail.');
                      }}
                      className={cn(
                        'inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-[#ffffff] text-xs font-semibold px-3 min-h-11 sm:min-h-9 rounded-lg transition-colors cursor-pointer',
                        focusRing
                      )}
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      Yes, delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      className={cn(
                        'bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold px-3 min-h-11 sm:min-h-9 rounded-lg transition-colors cursor-pointer',
                        focusRing
                      )}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(true)}
                      className={cn(
                        'inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-[#ffffff] text-xs font-semibold px-3 min-h-11 sm:min-h-9 rounded-lg transition-colors cursor-pointer',
                        focusRing
                      )}
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      Delete post
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReportResolved(true);
                        showToast('Report dismissed.');
                      }}
                      className={cn(
                        'bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold px-3 min-h-11 sm:min-h-9 rounded-lg transition-colors cursor-pointer',
                        focusRing
                      )}
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}
    </AppShell>
  );
}
