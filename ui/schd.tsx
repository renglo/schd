//import ToolGarticCRUD from "@/tools/gartic/pages/tool_gartic_crud"
import ToolDataCRUD from "../../../tools/data/ui/pages/tool_data_crud"

//import { useLocation } from "react-router-dom";

export default function Schd({ portfolio, org, tool, ring }: {
  portfolio: string;
  org: string;
  tool: string;
  ring?: string;  // optional prop since it might be undefined
}) {

    //const location = useLocation();
    //const page = location.pathname.split('/')[4]

    console.log('Schd > Ring:',ring)

    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
        
          <div className="flex flex-col sm:gap-2 sm:pl-2">

            {ring === 'schd_jobs' && <ToolDataCRUD readonly={false} portfolio={portfolio} org={org} tool={tool} ring={ring} />}
            {ring === 'schd_runs' && <ToolDataCRUD readonly={true} portfolio={portfolio} org={org} tool={tool} ring={ring} />}
            {ring === 'schd_rules' && <ToolDataCRUD readonly={false} portfolio={portfolio} org={org} tool={tool} ring={ring} />}

          </div>
        </div>
    )
}