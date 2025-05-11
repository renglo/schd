import {
  Bot,
  Bike,
  TimerReset,
  Wrench,
  Zap,
} from "lucide-react"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface ToolMenuProps {
    portfolio: string;
    org: string;
    tool?: string;
    ring?: string;
    onNavigate: (path: string) => void;
}

export default function ToolSchdSideNav({portfolio, org, tool, ring, onNavigate}:ToolMenuProps) {    
       
      return (  
        <nav 
          className={
            (!org || org=='settings' )
              ? 'hidden' 
              : 'flex flex-col items-center gap-4 px-1 sm:py-4'
          }  
        >           
          
          <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center flex-col">
                    <button
                      onClick={() => onNavigate(`/${portfolio}/${org}/schd/schd_jobs`)}
                      className={
                        ring === 'schd_jobs'
                          ? 'group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-gray-200 text-lg font-semibold text-muted-foreground md:h-12 md:w-12 md:text-base'
                          : 'flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8'
                      }
                    >
                        <Bot className="h-5 w-5" />
                        <span className="sr-only">Jobs</span>
                    </button>
                    <span className="text-xxs ">Jobs</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">Jobs</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center flex-col">
                    <button
                      onClick={() => onNavigate(`/${portfolio}/${org}/schd/schd_runs`)}
                      className={
                        ring === 'schd_runs'
                          ? 'group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-gray-200 text-lg font-semibold text-muted-foreground md:h-12 md:w-12 md:text-base'
                          : 'flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8'
                      }
                    >
                        <Bike className="h-5 w-5" />
                        <span className="sr-only">Runs</span>
                    </button>
                    <span className="text-xxs ">Runs</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">Runs</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center flex-col">
                    <button
                      onClick={() => onNavigate(`/${portfolio}/${org}/schd/schd_rules`)}
                      className={
                        ring === 'schd_rules'
                          ? 'group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-gray-200 text-lg font-semibold text-muted-foreground md:h-12 md:w-12 md:text-base'
                          : 'flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8'
                      }
                    >
                        <TimerReset className="h-5 w-5" />
                        <span className="sr-only">Rules</span>
                    </button>
                    <span className="text-xxs ">Rules</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">Rules</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center flex-col">
                    <button
                      onClick={() => onNavigate(`/${portfolio}/${org}/schd/schd_actions`)}
                      className={
                        ring === 'schd_actions'
                          ? 'group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-gray-200 text-lg font-semibold text-muted-foreground md:h-12 md:w-12 md:text-base'
                          : 'flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8'
                      }
                    >
                        <Zap className="h-5 w-5" />
                        <span className="sr-only">Actions</span>
                    </button>
                    <span className="text-xxs ">Actions</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">Actions</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center flex-col">
                    <button
                      onClick={() => onNavigate(`/${portfolio}/${org}/schd/schd_tools`)}
                      className={
                        ring === 'schd_tools'
                          ? 'group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-gray-200 text-lg font-semibold text-muted-foreground md:h-12 md:w-12 md:text-base'
                          : 'flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8'
                      }
                    >
                        <Wrench className="h-5 w-5" />
                        <span className="sr-only">Tools</span>
                    </button>
                    <span className="text-xxs ">Tools</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">Tools</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center flex-col">
                    <button
                      onClick={() => onNavigate(`/${portfolio}/${org}/schd/action`)}
                      className={
                        ring === 'action'
                          ? 'group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-gray-200 text-lg font-semibold text-muted-foreground md:h-12 md:w-12 md:text-base'
                          : 'flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8'
                      }
                    >
                        <Zap color="#19baf0" className="h-5 w-5" />
                        <span className="sr-only">Action</span>
                    </button>
                    <span className="text-xxs ">Action</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">Action</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center flex-col">
                    <button
                      onClick={() => onNavigate(`/${portfolio}/${org}/schd/tool`)}
                      className={
                        ring === 'tool'
                          ? 'group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-gray-200 text-lg font-semibold text-muted-foreground md:h-12 md:w-12 md:text-base'
                          : 'flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8'
                      }
                    >
                        <Wrench color="#19baf0" className="h-5 w-5" />
                        <span className="sr-only">Tool</span>
                    </button>
                    <span className="text-xxs ">Tool</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">Tool</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          

          
          
        </nav>
      )
    }