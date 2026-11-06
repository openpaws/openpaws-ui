import { execFileSync } from 'node:child_process'
import { API_DIR } from './helpers'

/** The register endpoint allows 3 per hour per IP; reset it so repeated local runs do not trip it. */
export default function globalSetup() {
  const code = `foreach (['127.0.0.1', '::1'] as $ip) { Illuminate\\Support\\Facades\\RateLimiter::clear(md5('register'.$ip)); }`
  try {
    execFileSync('php', ['artisan', 'tinker', '--execute', code], { cwd: API_DIR, stdio: 'pipe' })
  }
  catch (e) {
    console.warn('could not reset the register rate limiter:', (e as Error).message)
  }
}
