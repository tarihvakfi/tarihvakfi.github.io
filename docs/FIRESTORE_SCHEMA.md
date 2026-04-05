# Firestore şeması

## users

Doküman kimliği: `uid`

Önerilen alanlar:

- `uid`: string
- `fullName`: string
- `email`: string
- `phone`: string
- `department`: string
- `role`: `volunteer | coordinator | admin`
- `status`: `pending | approved | blocked`
- `notes`: string
- `createdAt`: timestamp
- `updatedAt`: timestamp
- `lastSeenAt`: timestamp

## tasks

- `title`: string
- `description`: string
- `department`: string
- `assignedToUid`: string | null
- `assignedToEmail`: string | null
- `dueDate`: string | null
- `priority`: `low | medium | high`
- `status`: `open | in_progress | done | cancelled`
- `createdByUid`: string
- `createdAt`: timestamp
- `updatedAt`: timestamp

## reports

- `userUid`: string
- `userEmail`: string
- `taskId`: string
- `summary`: string
- `hours`: number
- `reportDate`: string
- `status`: `submitted | reviewed | rejected`
- `reviewerUid`: string | null
- `createdAt`: timestamp
- `updatedAt`: timestamp

## announcements

- `title`: string
- `body`: string
- `audience`: `all | volunteers | coordinators | department`
- `department`: string
- `createdByUid`: string
- `createdAt`: timestamp

## activityLogs

- `actorUid`: string
- `actorEmail`: string
- `action`: string
- `targetType`: string
- `targetId`: string
- `metadata`: map
- `createdAt`: timestamp
