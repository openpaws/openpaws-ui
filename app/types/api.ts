/**
 * Types mirroring the OpenPaws JSON API as built:
 * openpaws-api feature/phase1 @ 187fdf2
 * (app/Http/Resources/*, routes/api.php, app/Enums/*, bootstrap/app.php).
 *
 * Wrapping: single resources are `{ data: T }`; lists are `{ data: T[], meta: { next_cursor } }`;
 * composites: GET /users/{u} -> UserProfileResponse, GET /tags/{slug} -> TagPageResponse.
 * useApi() returns the raw parsed JSON; callers read `.data` themselves.
 */

export type Rating = 'general' | 'mature' | 'adult'
export type SubmissionType = 'image' | 'writing' | 'audio' | 'video'
export type SubmissionStatus = 'processing' | 'published' | 'failed' | 'hidden' | 'removed'
export type Visibility = 'public' | 'unlisted'
export type UserRole = 'user' | 'moderator' | 'admin'
export type FolderKind = 'gallery' | 'scraps' | 'custom'
export type UploadKind = 'image' | 'audio' | 'video' | 'document' | 'cover' | 'avatar' | 'banner'
export type UploadStatus = 'pending' | 'uploaded' | 'consumed' | 'expired'

export type Single<T> = { data: T }
export type Paginated<T> = { data: T[], meta: { next_cursor: string | null } }

/** UserResource (public part). */
export interface User {
  username: string
  display_name: string | null
  avatar_url: string | null
  banner_url: string | null
  created_at: string | null
}

/** UserResource when the viewer is the user (GET /me). */
export interface Me extends User {
  email: string
  email_verified: boolean
  adult_confirmed: boolean
  max_rating: Rating
  role: UserRole
}

/** MediaAssetResource: optional fields are omitted when null. */
export interface MediaRef {
  url: string
  mime: string
  width?: number
  height?: number
  duration_ms?: number
  size_bytes: number
}

export type MediaRole
  = 'thumb_sm' | 'thumb_md' | 'thumb_lg' | 'preview' | 'original'
    | 'transcode' | 'cover' | 'waveform' | 'document'

/** SubmissionResource. `media` is always an object, empty for hidden/removed. */
export interface Submission {
  id: string
  type: SubmissionType
  title: string
  description: string | null
  description_html: string
  /** Describes the image for screen readers (U11); fall back to the title when null. */
  alt_text: string | null
  /** Only on GET /submissions/{id} for writing. */
  body?: string | null
  body_html?: string
  rating: Rating
  status: SubmissionStatus
  visibility: Visibility
  /** Tag slugs. */
  tags: string[]
  views_count: number
  published_at: string | null
  created_at: string | null
  user: User
  folders: { id: string, name: string, kind: FolderKind }[]
  media: Partial<Record<MediaRole, MediaRef>>
}

export interface ProfileLink {
  [key: string]: unknown
}

/** ProfileResource. */
export interface Profile {
  bio: string | null
  bio_html: string
  links: ProfileLink[]
  species: string | null
  pronouns: string | null
  pinned: Submission[]
}

/** FolderResource. */
export interface Folder {
  id: string
  name: string
  description: string | null
  kind: FolderKind
  position: number
  count: number
}

/** TagResource (unwrapped: `$wrap = null`). */
export interface Tag {
  slug: string
  usage_count: number
}

/** UploadSessionResource. `url` for single-PUT (only when freshly created), part_* for multipart. */
export interface UploadSession {
  id: string
  kind: UploadKind
  status: UploadStatus
  multipart: boolean
  expires_at: string
  part_size?: number
  part_count?: number
  url?: string
}

/** GET /users/{username} */
export interface UserProfileResponse { user: User, profile: Profile }
/** GET /tags/{slug}: a Paginated<Submission> plus the tag. */
export interface TagPageResponse extends Paginated<Submission> { tag: Tag }

/** Error body: `{ error: { code, message, fields? } }`. */
export interface ApiErrorBody {
  error: { code: string, message: string, fields?: Record<string, string[]> }
}
