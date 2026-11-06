<script setup lang="ts">
import type { Folder, Single, Submission } from '~/types/api'

const props = defineProps<{
  username: string
  folders: Folder[]
  /** Id of the folder whose items are shown. */
  current: string
  items: Submission[]
  loading: boolean
  done: boolean
}>()
const emit = defineEmits<{
  'update:items': [items: Submission[]]
  'loadAll': []
  'changed': [info: { deleted?: string }]
}>()

const api = useApi()
const toasts = useToasts()

// Create
const createForm = useFormError()
const newName = ref('')
async function create() {
  await createForm.run(async () => {
    await api<Single<Folder>>('/folders', { method: 'POST', body: { name: newName.value } })
    newName.value = ''
    emit('changed', {})
  })
}

// Rename / delete (custom folders only)
const renamingId = ref<string | null>(null)
const renameValue = ref('')
const confirmId = ref<string | null>(null)
const rowForm = useFormError()
function startRename(f: Folder) {
  renamingId.value = f.id
  renameValue.value = f.name
  confirmId.value = null
  rowForm.clear()
}
async function rename(f: Folder) {
  await rowForm.run(async () => {
    await api(`/folders/${f.id}`, { method: 'PATCH', body: { name: renameValue.value } })
    renamingId.value = null
    emit('changed', {})
  })
}
async function remove(f: Folder) {
  await rowForm.run(async () => {
    await api(`/folders/${f.id}`, { method: 'DELETE' })
    confirmId.value = null
    emit('changed', { deleted: f.id })
  })
}

// Reorder
const order = ref<Submission[]>(props.items.slice())
watch(() => props.items, (v) => { order.value = v.slice() })
const reorderForm = useFormError()
const dragFrom = ref<number | null>(null)

async function moveTo(from: number, to: number) {
  if (reorderForm.pending.value || from === to || to < 0 || to >= order.value.length) return
  const before = order.value.slice()
  const next = before.slice()
  next.splice(to, 0, next.splice(from, 1)[0]!)
  order.value = next
  emit('update:items', next)
  await reorderForm.run(async () => {
    try {
      await api(`/folders/${props.current}/order`, { method: 'PUT', body: { submission_ids: next.map(s => s.id) } })
      toasts.push('Order saved.')
    }
    catch (e) {
      order.value = before
      emit('update:items', before)
      throw e
    }
  })
}
function onDrop(to: number) {
  const from = dragFrom.value
  dragFrom.value = null
  if (from !== null) void moveTo(from, to)
}
</script>

<template>
  <section class="manager" aria-labelledby="fm-h" data-test="folder-manager">
    <h2 id="fm-h">Manage folders</h2>

    <ul class="rows">
      <li v-for="f in folders" :key="f.id" class="row" data-test="folder-row">
        <template v-if="renamingId === f.id">
          <form data-test="rename-form" @submit.prevent="rename(f)">
            <FormTextField v-model="renameValue" label="Folder name" name="rename" :error="rowForm.fieldError('name')" />
            <button type="submit" :disabled="rowForm.pending.value">
              Save
            </button>
            <button type="button" @click="renamingId = null">
              Cancel
            </button>
          </form>
        </template>
        <template v-else>
          <span class="name">{{ f.name }} <span class="muted">({{ f.count }})</span></span>
          <template v-if="f.kind === 'custom'">
            <button type="button" data-test="rename" :aria-label="`Rename ${f.name}`" @click="startRename(f)">
              Rename
            </button>
            <button v-if="confirmId !== f.id" type="button" data-test="delete" :aria-label="`Delete ${f.name}`" @click="confirmId = f.id; renamingId = null">
              Delete
            </button>
            <template v-else>
              <button type="button" data-test="confirm-delete" :disabled="rowForm.pending.value" @click="remove(f)">
                Confirm delete {{ f.name }}
              </button>
              <button type="button" @click="confirmId = null">
                Cancel
              </button>
            </template>
          </template>
        </template>
      </li>
    </ul>
    <FormErrors :message="rowForm.message.value" />

    <form class="create" data-test="create" @submit.prevent="create">
      <FormTextField v-model="newName" label="New folder" name="new_folder" :error="createForm.fieldError('name')" />
      <button type="submit" :disabled="createForm.pending.value">
        Create folder
      </button>
    </form>
    <FormErrors :message="createForm.message.value" />

    <h3>Reorder items</h3>
    <p v-if="!order.length" class="muted">
      Nothing to reorder.
    </p>
    <template v-else-if="!done">
      <p class="muted">
        Load all items to reorder.
      </p>
      <button type="button" data-test="load-all" :disabled="loading" @click="emit('loadAll')">
        Load all items to reorder
      </button>
    </template>
    <ol v-else class="reorder">
      <li
        v-for="(s, i) in order"
        :key="s.id"
        data-test="reorder-item"
        :data-id="s.id"
        draggable="true"
        @dragstart="dragFrom = i"
        @dragover.prevent
        @drop.prevent="onDrop(i)"
        @dragend="dragFrom = null"
      >
        <span class="title">{{ s.title }}</span>
        <button type="button" data-test="up" :aria-label="`Move ${s.title} up`" :disabled="i === 0 || reorderForm.pending.value" @click="moveTo(i, i - 1)">
          Move up
        </button>
        <button type="button" data-test="down" :aria-label="`Move ${s.title} down`" :disabled="i === order.length - 1 || reorderForm.pending.value" @click="moveTo(i, i + 1)">
          Move down
        </button>
      </li>
    </ol>
    <FormErrors :message="reorderForm.message.value" />
  </section>
</template>

<style scoped>
.manager { margin: 1.5rem 0; padding: 1rem; border: 1px solid var(--border); border-radius: 0.5rem; display: grid; gap: 0.75rem; }
.rows, .reorder { margin: 0; padding: 0; list-style: none; display: grid; gap: 0.4rem; }
.reorder { list-style: decimal inside; }
.row, .reorder li { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; padding: 0.4rem 0.5rem; border: 1px solid var(--border); border-radius: 0.4rem; }
.reorder li { cursor: grab; }
.name, .title { flex: 1; min-width: 8rem; }
.muted { color: var(--muted); margin: 0; }
button { font: inherit; min-height: 2.25rem; padding: 0 0.75rem; cursor: pointer; }
h2, h3 { margin: 0; }
</style>
