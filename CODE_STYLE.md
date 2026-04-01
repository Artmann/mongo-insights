- Don't use CONSTANT_CASE. This is not JAVA.
- Use entire words as variable names. This is not Go. For example `request`
  instead of `req`.
- Use punctuation.
- Use whitespace to break up code to make it easier to read. Put a blank like
  after const groups and control flows and before return statements.
- Order things in alphabetical order by default. If applicable order by
  accessiblity level first, then alphabetical order.
- No any: Use proper types or unknown
- No Non-null Assertions: Avoid ! operator
- Prefer Nullish Coalescing: Use ?? over ||
- No Floating Promises: Always await or handle promises
- Single quotes
- No semicolons

## Code Style

Use blank lines to separate logical groups within a function body. Separate
declarations, side effects, and return statements from each other.

```ts
// Bad
const formData = await request.formData()
await processForm(formData)
return redirect('/dashboard')

// Good
const formData = await request.formData()

await processForm(formData)

return redirect('/dashboard')
```

Group related declarations together, then separate from the next logical step:

```ts
// Bad
const user = await getUser(request)
const org = await getOrg(user.orgId)
await trackEvent(user, org)
const data = await loadData(org)
return json(data)

// Good
const user = await getUser(request)
const org = await getOrg(user.orgId)

await trackEvent(user, org)

const data = await loadData(org)

return json(data)
```

## Testing

- Put test files next to the implementation.
- Prefer `toEqual` over `toBe`
- Compare entire objects instead of single properties.
  `expect(product).toEqual({ id: 1, name: 'Cup' })`
