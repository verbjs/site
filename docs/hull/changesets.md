# Changesets

Changesets validate and cast data before database operations, inspired by Ecto's changeset pattern.

## Creating a Changeset

```typescript
import { changeset, cast } from "hull"

// Create empty changeset
const cs = changeset(User, {})

// Cast data into changeset (only specified fields are allowed)
const validated = cast(cs, {
  email: "bob@example.com",
  name: "Bob",
  admin: true  // Will be ignored - not in allowed fields
}, ["email", "name"])
```

## Validation

Add validations to changesets:

```typescript
import { validateRequired, validateLength, validateFormat } from "hull"

let cs = changeset(User, {})
cs = cast(cs, data, ["email", "name", "password"])
cs = validateRequired(cs, ["email", "password"])
cs = validateLength(cs, "password", { min: 8, max: 100 })
cs = validateFormat(cs, "email", /^[^\s@]+@[^\s@]+\.[^\s@]+$/)
```

## Checking Validity

```typescript
if (cs.valid) {
  const user = await insert(repo, cs)
} else {
  console.log(cs.errors)
  // { email: ["is required"], password: ["must be at least 8 characters"] }
}
```

## Updating Records

Use changesets with existing data:

```typescript
// Fetch existing user
const user = await one(repo, whereEq(from(User), "id", userId))

// Create changeset from existing data
const cs = cast(
  changeset(User, user),
  { name: "New Name" },
  ["name"]
)

// Update
const updated = await update(repo, cs, "id", userId)
```

## Custom Validation

```typescript
const validatePasswordMatch = (cs, field1, field2) => {
  if (cs.changes[field1] !== cs.changes[field2]) {
    return {
      ...cs,
      valid: false,
      errors: { ...cs.errors, [field2]: ["does not match"] }
    }
  }
  return cs
}

cs = validatePasswordMatch(cs, "password", "password_confirmation")
```

## Changeset Structure

```typescript
type Changeset<S> = {
  schema: S
  data: Record<string, unknown>      // Original data
  changes: Record<string, unknown>   // New/modified values
  errors: Record<string, string[]>   // Validation errors
  valid: boolean                     // Overall validity
}
```
