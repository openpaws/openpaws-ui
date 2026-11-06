import { execFileSync } from 'node:child_process'
import { API_DIR } from './helpers'

/** Removes every e2e_ user together with their submissions (and their search-index entries). */
export default function globalTeardown() {
  const code = `
    config(['scout.queue' => false]);
    $users = App\\Models\\User::where('username', 'like', 'e2e\\\\_%')->get();
    foreach ($users as $u) {
      App\\Models\\Submission::withTrashed()->where('user_id', $u->id)->get()->each(function ($s) { $s->unsearchable(); $s->forceDelete(); });
      $u->delete();
    }
    echo 'e2e cleanup: removed ' . $users->count() . ' user(s)';
  `
  try {
    console.log(execFileSync('php', ['artisan', 'tinker', '--execute', code], { cwd: API_DIR, encoding: 'utf8' }).trim())
  }
  catch (e) {
    console.warn('e2e cleanup failed:', (e as Error).message)
  }
}
