import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { useHotkeys } from 'react-hotkeys-hook'
import { DatabaseIcon } from 'lucide-react'

import { useDatabases } from '@/hooks/use-databases'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'

export function CommandPalette() {
  const [open, setOpen] = useState(false)

  const { databaseName } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { data } = useDatabases()

  const databases = data?.databases ?? []

  useHotkeys('mod+k', (event) => {
    event.preventDefault()
    setOpen((previous) => !previous)
  })

  function getHref(name: string) {
    if (!databaseName) {
      return `/databases/${name}`
    }

    const prefix = `/databases/${databaseName}`
    const suffix = location.pathname.startsWith(prefix)
      ? location.pathname.slice(prefix.length)
      : ''

    return `/databases/${name}${suffix}`
  }

  function handleSelect(name: string) {
    void navigate(getHref(name))
    setOpen(false)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Switch database"
      description="Search and navigate to a database."
    >
      <Command>
        <CommandInput placeholder="Search databases..." />
        <CommandList>
          <CommandEmpty>No databases found.</CommandEmpty>
          <CommandGroup heading="Databases">
            {databases.map((database) => (
              <CommandItem
                key={database.name}
                value={database.name}
                onSelect={() => handleSelect(database.name)}
                data-checked={database.name === databaseName}
              >
                <DatabaseIcon className="size-4 opacity-50" />
                {database.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
