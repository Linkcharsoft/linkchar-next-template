'use client'
import { useRouter } from 'next/navigation'
import { Column } from 'primereact/column'
import { DataTable } from 'primereact/datatable'
import { Paginator } from 'primereact/paginator'
import useSWR from 'swr'
import { useMediaQuery } from 'usehooks-ts'
import { getTestData } from '@/api/example'
import CustomButton from '@/components/CustomButton'
import Filters from '@/components/Filters'
import SearchInput from '@/components/SearchInput'
import { useTableParams } from '@/hooks/useTableParams'
import useModalStore from '@/stores/modalStore'
import useUserStore from '@/stores/userStore'
import type { FilterItem } from '@/components/Filters'


const ExamplePage = ({ searchParams }) => {
  const { setNotification, openModal } = useModalStore()
  const { token } = useUserStore()
  const router = useRouter()
  const isMobile = useMediaQuery('(max-width: 768px)')


  const {
    params,
    stringParams,
    first,
    sortProps,
    setParams,
    setParam,
    setPagination,
    resetParams
    // clearParams
  } = useTableParams({
    searchParams,
    defaultParams: {
      page: {
        type: 'number',
        value: 1
      },
      page_size: {
        type: 'number',
        value: 10
      },
      search: {
        type: 'string'
        // value: 'ca'
      },
      ordering: {
        type: 'string'
        // value: '-full_name'
      },
      'unique-string': {
        type: 'string'
        // value: 'test-1'
      },
      'unique-number': {
        type: 'number'
        // value: 1
      },
      'multiple-string': {
        type: 'string',
        // value: ['test-1']
        isArray: true
      },
      'multiple-number': {
        type: 'number',
        // value: [1, 2, 3],
        isArray: true
      },
      'boolean': {
        type: 'boolean'
        // value: false
      },
      'dropdown-unique': {
        type: 'number'
        // value: 1
      },
      'dropdown-multiple': {
        type: 'number',
        // value: [1],
        isArray: true
      },
      'date-unique': {
        // value: '2026-01-22',
        type: 'string'
      },
      'date-multiple': {
        type: 'string',
        isArray: true
      },
      'date-range-min': {
        type: 'string'
      },
      'date-range-max': {
        type: 'string'
      }
    }
  })

  const FILTERS: FilterItem['filters'] = [
    {
      type: 'pill',
      title: 'Pills - Unique String',
      options: [
        {
          label: 'Test 1',
          value: 'test-1',
          color: 'red'
        }, {
          label: 'Test 2',
          value: 'test-2',
          color: 'blue'
        }, {
          label: 'Test 3',
          value: 'test-3',
          color: 'green'
        }, {
          label: 'Test 4',
          value: 'test-4',
          color: 'yellow'
        }, {
          label: 'Test 5',
          value: 'test-5',
          color: 'purple'
        }
      ],
      selected: params['unique-string'],
      onChange: (value: string) => setParam('unique-string', value)
    }, {
      type: 'pill',
      title: 'Pills - Unique Number',
      options: [
        {
          label: 'Test 1',
          value: 1
        }, {
          label: 'Test 2',
          value: 2
        }, {
          label: 'Test 3',
          value: 3
        }, {
          label: 'Test 4',
          value: 4
        }, {
          label: 'Test 5',
          value: 5
        }
      ],
      selected: params['unique-number'],
      onChange: (value: number) => setParam('unique-number', value)
    }, {
      type: 'pill',
      title: 'Pills - Multiple String',
      options: [
        {
          label: 'Test 1',
          value: 'test-1'
        }, {
          label: 'Test 2',
          value: 'test-2'
        }, {
          label: 'Test 3',
          value: 'test-3'
        }, {
          label: 'Test 4',
          value: 'test-4'
        }, {
          label: 'Test 5',
          value: 'test-5'
        }
      ],
      selected: params['multiple-string'],
      multiple: true,
      onChange: (value: string[]) => setParam('multiple-string', value)
    }, {
      type: 'pill',
      title: 'Pills - Multiple Number',
      options: [
        {
          label: 'Test 1',
          value: 1,
          color: 'red'
        }, {
          label: 'Test 2',
          value: 2,
          color: 'blue'
        }, {
          label: 'Test 3',
          value: 3,
          color: 'green'
        }, {
          label: 'Test 4',
          value: 4,
          color: 'yellow'
        }, {
          label: 'Test 5',
          value: 5,
          color: 'purple'
        }
      ],
      selected: params['multiple-number'],
      multiple: true,
      onChange: (value: number[]) => setParam('multiple-number', value)
    }, {
      type: 'pill',
      title: 'Pills - Boolean',
      options: [
        {
          label: 'Test True',
          value: true
        }, {
          label: 'Test False',
          value: false
        }
      ],
      selected: params['boolean'],
      onChange: (value: boolean) => setParam('boolean', value)
    }, {
      type: 'dropdown',
      title: 'Dropdown - Unique Value',
      options: [
        {
          label: 'Test 1',
          value: 1
        }, {
          label: 'Test 2',
          value: 2
        }, {
          label: 'Test 3',
          value: 3
        }, {
          label: 'Test 4',
          value: 4
        }, {
          label: 'Test 5',
          value: 5
        }
      ],
      selected: params['dropdown-unique'],
      onChange: (value: number) => setParam('dropdown-unique', value)
    }, {
      type: 'dropdown',
      title: 'Dropdown - Multiple Value',
      options: [
        {
          label: 'Test 1',
          value: 1
        }, {
          label: 'Test 2',
          value: 2
        }, {
          label: 'Test 3',
          value: 3
        }, {
          label: 'Test 4',
          value: 4
        }, {
          label: 'Test 5',
          value: 5
        }
      ],
      selected: params['dropdown-multiple'],
      multiple: true,
      onChange: (value: number[]) => setParam('dropdown-multiple', value)
    },
    {
      type: 'date',
      title: 'Date - Unique Value',
      selected: params['date-unique'],
      onChange: (value) => setParam('date-unique', value)
    }, {
      type: 'date',
      title: 'Date - Multiple Value',
      selected: params['date-multiple'],
      onChange: (value) => setParam('date-multiple', value),
      multiple: true
    }, {
      type: 'date-range',
      title: 'Date - Range Value',
      selected: {
        from: params['date-range-min'],
        to: params['date-range-max']
      },
      onChange: (value) => {
        console.log(value)
        setParams({
          'date-range-min': value.from,
          'date-range-max': value.to
        })
      }
    }
  ]

  const {
    data: employeesData,
    isLoading: employeesIsLoading
  } = useSWR(
    token ? `/notifications/?${stringParams}` : null,
    (path) => getTestData(path, token!),
    {
      refreshInterval: 60000
    }
  )

  return (
    <main className='ExamplePage'>
      <section className='flex w-full items-center justify-between px-6 py-2'>
        <div className="flex items-center gap-2">
          <span className='text-bold-16'>Notifications</span>

          <CustomButton
            variant='success'
            onClick={() => setNotification({
              severity: 'success',
              summary: 'Summary 1',
              detail: 'Detail 1'
            })}
          >Success</CustomButton>
          <CustomButton
            variant='info'
            onClick={() => setNotification({
              severity: 'info',
              summary: 'Summary 2',
              detail: 'Detail 2'
            })}
          >Info</CustomButton>
          <CustomButton
            variant='warn'
            onClick={() => setNotification({
              severity: 'warn',
              summary: 'Summary 3',
              detail: 'Detail 3'
            })}
          >Warn</CustomButton>
          <CustomButton
            variant='error'
            onClick={() => setNotification({
              severity: 'error',
              summary: 'Summary 4',
              detail: 'Detail 4'
            })}
          >Error</CustomButton>
        </div>

        <div className="flex items-center gap-2">
          <span className='text-bold-16'>States Modal</span>

          <CustomButton
            variant='success'
            onClick={() => openModal('stateModal', {
              type: 'success',
              title: 'Summary 1',
              subtitle: 'Subtitle 1',
              content: 'Detail 1'
            })}
          >Success</CustomButton>
          <CustomButton
            variant='info'
            onClick={() => openModal('stateModal', {
              type: 'info',
              title: 'Summary 2',
              subtitle: 'Subtitle 2',
              content: 'Detail 2'
            })}
          >Info</CustomButton>
          <CustomButton
            variant='warn'
            onClick={() => openModal('stateModal', {
              type: 'warn',
              title: 'Summary 3',
              subtitle: 'Subtitle 3',
              content: 'Detail 3'
            })}
          >Warn</CustomButton>
          <CustomButton
            variant='error'
            onClick={() => openModal('stateModal', {
              type: 'error',
              title: 'Summary 4',
              subtitle: 'Subtitle 4',
              content: 'Detail 4'
            })}
          >Error</CustomButton>
        </div>

        <CustomButton
          variant='primary'
          onClick={async () => {
            const result = await fetch('/api/auth/logout', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              }
            })

            router.replace('/login')
          }}
        >Logout</CustomButton>
      </section>

      <section className="ExamplePage__Content">
        <header className="ExamplePage__Filters">
          <div className="flex items-center gap-4 xl:gap-5">
            <span className="text-primary text-bold-16 hidden xl:inline">Test Table</span>

            <SearchInput
              initialValue={params.search}
              onChange={(value) => setParam('search', value)}
              disabled={employeesIsLoading}
            />

            <div className="flex items-center gap-2">
              <span className="text-bold-14">{employeesData?.data.count || 0}</span>
              <span>Results</span>
            </div>
          </div>

          <Filters
            filters={FILTERS}
            cleanFilters={resetParams}
            locale='es'
            disabled={employeesIsLoading}
          />
        </header>

        <header className="ExamplePage__Filters--Mobile">
          <div className="flex items-center gap-2">
            <SearchInput
              initialValue={params.search}
              onChange={(value) => setParam('search', value)}
              disabled={employeesIsLoading}
            />
            <Filters
              filters={FILTERS}
              cleanFilters={resetParams}
              locale='es'
              disabled={employeesIsLoading}
            />
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-bold-14">{employeesData?.data.count || 0}</span>
              <span>Resultados</span>
            </div>
          </div>
        </header>

        <DataTable
          className="Table"
          dataKey="pk"
          scrollable
          scrollHeight='100%'
          value={employeesData?.data?.results}
          rows={params.page_size}
          emptyMessage={
            <div className='flex size-full flex-col items-center justify-center gap-4'>
              <i className="pi pi-search text-28"></i>
              <span className='text-bold-16'>No se encontraron trabajadores</span>
              <CustomButton
                variant='primary'
                onClick={resetParams}
              >
                <i className="pi pi-trash text-14" />
                <span className="text-14">Limpiar filtros</span>
              </CustomButton>
            </div>
          }
          loading={employeesIsLoading}
          sortField={sortProps?.sortField}
          sortOrder={sortProps?.sortOrder}
          onSort={sortProps?.onSort}
          removableSort
        >
          <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} />

          <Column
            field="id"
            header="ID"
            sortable
          />

          <Column
            field="verb"
            header="Verb"
            sortable
          />

          <Column
            field="description"
            header="Description"
            sortable
          />

          <Column
            field="timestamp"
            header="Timestamp"
            sortable
          />
        </DataTable>

        {(Number(employeesData?.data?.count) > 0) && (
          <Paginator
            className='Paginator'
            first={first}
            rows={params.page_size}
            totalRecords={employeesData?.data.count}
            rowsPerPageOptions={[10, 20, 30]}
            onPageChange={(e) => {
              setPagination({
                page: e.page + 1,
                page_size: e.rows
              })
            }}
            pt={{
              root: {
                className: 'bg-transparent p-0 flex-nowrap'
              },
              RPPDropdown: {
                root: {
                  className: '!w-[80px]'
                }
              }
            }}
            template={isMobile
              ? 'PrevPageLink CurrentPageReport NextPageLink RowsPerPageDropdown'
              : 'FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown'
            }
            currentPageReportTemplate={'{currentPage} de {totalPages}'}
          />
        )}
      </section>
    </main>
  )
}

export default ExamplePage