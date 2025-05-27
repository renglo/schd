import {
  CircleHelp,
} from "lucide-react"


import { Button } from "@/components/ui/button"
import {
Card,
CardContent,
CardFooter,
CardHeader,
CardTitle,
} from "@/components/ui/card"


import { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";

import DialogPutWide from '@/components/tank/dialog-put-wide'
import DynamicSelect from '@/components/tank/dynamic-select'


import TriggerEndpoint from "@/components/tank/trigger-endpoint"


interface Blueprint {
  label: string;
  // Add other properties as needed
  [key: string]: any; // This allows for additional dynamic properties if necessary
}


interface DataType {
name?: string;
_id?: string;
[key: string]: any; // Additional properties
}

interface FieldDictionary {
[key: string]: {
  label?: string;
  hint?: string;
  widget?: string;
};
}

interface BlueprintField {
name: string;
label?: string;
hint?: string;
widget?: string;
}

interface ToolDataCRUDProps {
  portfolio: string;
  org: string;
  tool: string;
  ring: string;
}


export default function SchdActionProbe({ portfolio, org, tool }: ToolDataCRUDProps) {


  //const [data, setData] = useState({}); // State to hold table data
  const [data, setData] = useState<DataType>({});

  //const [loading, setLoading] = useState(true); // State to manage loading status
  const [error, setError] = useState<Error | null>(null);
  const [refresh, setRefresh] = useState(false);
  const [fieldsDictionary, setFieldsDictionary] = useState<FieldDictionary>({});
  const [blueprint, setBlueprint] = useState<Blueprint>({ label: '' });
  const [actionId, setActionId] = useState<string | null>(null);

  const [activeOps, setActiveOps] = useState<boolean>(false);

  const [slots, setSlots] = useState<Record<string, string>>({});
  const [slotValues, setSlotValues] = useState<Record<string, string>>({});

  const [response, setResponse] = useState<any>(null);
  const [errorResponse, setErrorResponse] = useState<any>(null);


  console.log('TGC>Portfolio:',portfolio)
  console.log('TGC>Org:',org)
  console.log('TGC>Tool:',tool)

  const ring = 'schd_actions';



  // 1
  useEffect(() => {
      // Function to fetch config Blueprint
      const fetchBlueprint = async () => {
        try {
          // Fetch Blueprint
          const blueprintResponse = await fetch(`${import.meta.env.VITE_API_URL}/_blueprint/irma/${ring}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${sessionStorage.accessToken}`,
            },
          });
          const blueprintData = await blueprintResponse.json();
          setBlueprint(blueprintData);

  
        } catch (err) {
          if (err instanceof Error) {
            setError(err);  // Now TypeScript knows `err` is of type `Error`.
          } else {
            setError(new Error("An unknown error occurred"));  // Handle other types
          }
          console.log(error)
        } finally {
          //setLoading(false);
        }
      };
  
      fetchBlueprint();
  }, []);


  // 2
  useEffect(() => {
      // Function to fetch the singleton config document
      const fetchData = async () => {
          try {

          console.log('About to fetch the selected action');
          
          // Fetch Data
          
          const dataResponse = await fetch(`${import.meta.env.VITE_API_URL}/_data/${portfolio}/${org}/${ring}/${actionId}`, {
              method: 'GET',
              headers: {
              'Authorization': `Bearer ${sessionStorage.accessToken}`,
              },
          });
          const response = await dataResponse.json();
          setData(response);

          
      
          } catch (err) {
            if (err instanceof Error) {
              setError(err);  // Now TypeScript knows `err` is of type `Error`.
            } else {
              setError(new Error("An unknown error occurred"));  // Handle other types
            }
            console.log(error)
          } finally {
          //setLoading(false);
          }
      };
      
      fetchData();
  }, [org,refresh,actionId]);



  
  // 3
  useEffect(() => {
      const dictionary: FieldDictionary = {};
      if (blueprint && blueprint.fields) {
          blueprint.fields.forEach((field: BlueprintField) => {
              dictionary[field.name] = field;
          });
      }
      setFieldsDictionary(dictionary);
  }, [blueprint]);


  // Parse slots JSON when data changes
  useEffect(() => {
      if (data?.['slots']) {
          try {
              const parsedSlots = JSON.parse(data['slots']);
              setSlots(parsedSlots);
              // Initialize slot values with empty strings
              const initialValues = Object.keys(parsedSlots).reduce((acc, key) => {
                  acc[key] = '';
                  return acc;
              }, {} as Record<string, string>);
              setSlotValues(initialValues);
          } catch (e) {
              //console.error('Error parsing slots:', e);
              setSlots({})
              setSlotValues({})
          }
      }
  }, [data]);

    
  // Function to update the state
  const refreshAction = () => {
      setRefresh(prev => !prev); // Toggle the `refresh` state to trigger useEffect
      //refreshUp();
  };

  // Function to update the state
  const statusAction = () => {
      //setActiveGame(true);
      setActiveOps(true);
      
  };



  const actionValueChange = (value: string) => {
      console.log(`Action changed!: ${value}`);
      setActionId(value);
      setResponse(null);
      setErrorResponse(null);
  };

  const handleSlotChange = (key: string, value: string) => {
      setSlotValues(prev => ({
          ...prev,
          [key]: value
      }));
  };

  const handleTriggerManual = () => {
      // Create payload with current slot values
      const payload = {
          ...data,
          slots: slotValues
      };
      // Call your existing trigger function with the payload
      // triggerManual(payload);
  };

  const handleResponse = (responseData: any) => {
      setResponse(responseData);
  };

  const handleError = (errorData: any) => {
      setErrorResponse(errorData);
  };

  //---------------------------------------------------

  const captions_troubleshoot = {
    'response_ok_title':'Running action',
    'response_ok_content':'Action has been executed',
    'response_ko_title':'Action has failed',
    'response_ko_content':'Please check your parameters',
    'dialog_title':data['name'],
    'dialog_instructions':`${data['handler']}`,
    'dialog_cta':'Run'
  }



  return (

  <>
    <Card
      className="mx-auto w-full sm:w-3/4 overflow-hidden"
    > 
      <CardHeader>
        <CardTitle className="flex flex-col gap-6">
          Actions
          <DynamicSelect
              label = 'Action'
              hint = ''
              source = 'schd_actions:_id:name'
              portfolio_id = {portfolio}
              org_id = {org}
              onValueChange = {actionValueChange}
              default_value = 'Select an action'
          />
        </CardTitle>
      </CardHeader>
      
      {actionId && (
        <>
          <CardContent className="flex flex-col gap-12 p-6 text-sm max-h-[70vh] overflow-y-auto">  
            <div className="grid gap-3">
              <Card className="hidden">
                <CardHeader>
                          <div className="text-muted-foreground">
                              Test Action
                          </div>                 
                </CardHeader> 
                <CardContent className="flex flex-col gap-3 items-center">
                  <span className="flex flex-row justify-between w-full gap-6">
                    <div className="flex-1 space-y-4">
                        {Object.entries(slots).map(([key, description]) => (
                            <div key={key} className="flex flex-col space-y-2">
                                <label className="text-sm font-medium text-gray-700">
                                    {description}
                                </label>
                                <Input
                                    type="text"
                                    value={slotValues[key] || ''}
                                    onChange={(e) => handleSlotChange(key, e.target.value)}
                                    placeholder={`Enter ${key}`}
                                />
                            </div>
                        ))}
                    </div>
                    <div className="flex-1">
                        Input:
                        <pre className="text-sm bg-gray-100 p-2 rounded">
                            {JSON.stringify(slotValues, null, 2)}
                        </pre>
                    </div>
                    <div className="flex-1 gap-3">
                        Output:
                        <pre className="text-sm bg-gray-100 p-2 rounded">
                            {JSON.stringify(response, null, 2)}
                        </pre>
                        
                        {errorResponse && (
                        <>
                        Error:
                        <pre className="text-sm bg-gray-100 p-2 rounded">
                            {JSON.stringify(errorResponse, null, 2)}
                        </pre>
                        </>  
                        
                    
                          )}
                    </div>
                    
                  </span>  
                  
                  
                  
                
                  
                  <TriggerEndpoint
                      path = {`${import.meta.env.VITE_API_URL}/_schd/${portfolio}/${org}/call/${data?.['handler']}`}
                      method = 'POST'
                      payload={slotValues}
                      statusUp={statusAction}
                      captions={captions_troubleshoot}
                      onResponse={handleResponse}
                      onError={handleError}
                  />
                  
                </CardContent>
                <CardFooter>

                </CardFooter>
              </Card>

               
            
            
            {Object.entries(data)
              .sort(([keyA], [keyB]) => {
                const orderA = fieldsDictionary[keyA]?.order ?? Number.MAX_SAFE_INTEGER;
                const orderB = fieldsDictionary[keyB]?.order ?? Number.MAX_SAFE_INTEGER;
                return orderA - orderB;
              })
              .map(([key, value]) => (
                fieldsDictionary[key]?.widget !== 'image' && 
                !key.startsWith('_') && 
                (fieldsDictionary[key]?.layer ?? 0) == 1 ? (
                    <Card 
                        key={key}
                        
                    >
                      <CardHeader>
                          <div className="text-muted-foreground">
                              {fieldsDictionary[key]?.label}
                          </div>                 
                      </CardHeader>   
                      <CardContent className="group flex items-center justify-between">
                          <span className="flex items-center gap-1">
                              <DialogPutWide
                                  selectedKey={key} 
                                  selectedValue={value} 
                                  refreshUp={refreshAction}
                                  blueprint={blueprint}
                                  title='Edit attribute'
                                  instructions={fieldsDictionary[key]?.hint ?? ''}
                                  path={`${import.meta.env.VITE_API_URL}/_data/${portfolio}/${org}/${ring}/${actionId}`}
                                  method='PUT'
                              />
                              <span className="whitespace-pre-wrap">
                                {blueprint?.rich?.[blueprint.sources?.[key]?.split(':')[0]]?.[value] ?? value}
                              </span>
                          </span>  
                      </CardContent>  
                      <CardFooter>
                      {
                        <span className="flex flex-row items-center gap-5">
                          <CircleHelp className="h-3 w-3" />
                          <div className="text-xs">
                                {fieldsDictionary[key]?.hint}
                          </div>
                        </span>
                        
                      }              
                      </CardFooter>                   
                           
                    </Card>
                ) : null


            ))}
            
          </div>   
          
          
        </CardContent>
        <CardFooter className="flex flex-row items-center border-t bg-muted/50 px-6 py-3">
          <div className="text-xs text-muted-foreground">
            Last Updated <time dateTime="2023-11-23">{data._modified}</time>
          </div>
        </CardFooter>
      </>
      )}
    </Card>
  </> 
  )
}