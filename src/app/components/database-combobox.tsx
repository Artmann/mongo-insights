import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { ChevronsUpDown } from 'lucide-react'

import { useDatabases } from '@/hooks/use-databases'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'

export function DatabaseCombobox() {
  const [open, setOpen] = useState(false)

  const { databaseName } = useParams()
  const location = useLocation()
  const { data } = useDatabases()

  const databases = data?.databases ?? []

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

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
    >
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className="w-72 justify-between"
          >
            {databaseName ?? 'Select database...'}
            <ChevronsUpDown className="opacity-50" />
          </Button>
        }
      />

      <PopoverContent
        className="w-72 p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search databases..." />
          <CommandList>
            <CommandEmpty>No databases found.</CommandEmpty>
            <CommandGroup>
              {databases.map((database) => (
                <Link
                  key={database.name}
                  to={getHref(database.name)}
                  onClick={() => setOpen(false)}
                  className="block"
                >
                  <CommandItem
                    value={database.name}
                    data-checked={database.name === databaseName}
                  >
                    {database.name}
                  </CommandItem>
                </Link>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
