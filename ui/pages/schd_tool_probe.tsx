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
import { Textarea } from "@/components/ui/textarea";

import DialogPutWide from '@/components/console/dialog-put-wide'
import DynamicSelect from '@/components/console/dynamic-select'


import TriggerEndpoint from "@/components/console/trigger-endpoint"


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
  order?: number;
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


export default function SchdToolProbe({ portfolio, org, tool }: ToolDataCRUDProps) {


  //const [data, setData] = useState({}); // State to hold table data
  const [data, setData] = useState<DataType>({});

  //const [loading, setLoading] = useState(true); // State to manage loading status
  const [error, setError] = useState<Error | null>(null);
  const [refresh, setRefresh] = useState(false);
  const [fieldsDictionary, setFieldsDictionary] = useState<FieldDictionary>({});
  const [blueprint, setBlueprint] = useState<Blueprint>({ label: '' });
  const [toolId, setToolId] = useState<string | null>(null);

  const [activeOps, setActiveOps] = useState<boolean>(false);

  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  const [response, setResponse] = useState<any>(null);
  const [errorResponse, setErrorResponse] = useState<any>(null);


  console.log('TGC>Portfolio:',portfolio)
  console.log('TGC>Org:',org)
  console.log('TGC>Tool:',tool)

  const ring = 'schd_tools';



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
      // Function to fetch the input documents
      const fetchData = async () => {
          try {
          // Fetch Data
          
          const dataResponse = await fetch(`${import.meta.env.VITE_API_URL}/_data/${portfolio}/${org}/${ring}/${toolId}`, {
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
  }, [org,refresh,toolId]);



  
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


  // Parse inputs JSON when data changes
  useEffect(() => {
      if (data?.['input']) {
          try {
              const parsedInput = JSON.parse(data['input']);
              
              // Handle new format: array of objects with name, hint, type, required
              if (Array.isArray(parsedInput)) {
                  const inputFields = parsedInput.reduce((acc, field) => {
                      acc[field.name] = field;
                      return acc;
                  }, {} as Record<string, any>);
                  setInputs(inputFields);
                  
                  // Initialize input values with empty strings
                  const initialValues = parsedInput.reduce((acc, field) => {
                      acc[field.name] = '';
                      return acc;
                  }, {} as Record<string, string>);
                  setInputValues(initialValues);
              } else {
                  // Handle old format: simple object with field names as keys
                  setInputs(parsedInput);
                  // Initialize input values with empty strings
                  const initialValues = Object.keys(parsedInput).reduce((acc, key) => {
                      acc[key] = '';
                      return acc;
                  }, {} as Record<string, string>);
                  setInputValues(initialValues);
              }
          } catch (e) {
              //console.error('Error parsing inputs:', e);
              setInputs({})
              setInputValues({})
          }
      }
  }, [data,toolId]);

    
  // Function to update the state
  const refreshTool = () => {
      setRefresh(prev => !prev); // Toggle the `refresh` state to trigger useEffect
      //refreshUp();
  };

  // Function to update the state
  const statusTool = () => {
      //setActiveGame(true);
      setActiveOps(true);
      
  };



  const toolValueChange = (value: string) => {
      console.log(`Tool changed!: ${value}`);
      setToolId(value);
      setResponse(null);
      setErrorResponse(null);
  };

  const handleInputChange = (key: string, value: string) => {
      // Only normalize tabs to spaces, but preserve all other whitespace
      const cleanedValue = value.replace(/\t/g, ' ');
      setInputValues(prev => ({
          ...prev,
          [key]: cleanedValue
      }));
  };

  

  const handleResponse = (responseData: any) => {
      setResponse(responseData);
      setErrorResponse(null);
  };

  const handleError = (errorData: any) => {
      setErrorResponse(errorData);
      setResponse(null);
  };

  //---------------------------------------------------

  const captions_troubleshoot = {
    'response_ok_title':'Running tool',
    'response_ok_content':'Tool has been executed',
    'response_ko_title':'Tool has failed',
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
          Tools
          <DynamicSelect
              label = 'Tool'
              hint = ''
              source = 'schd_tools:_id:name'
              portfolio_id = {portfolio}
              org_id = {org}
              onValueChange = {toolValueChange}
              default_value = 'Select a tool'
          />
        </CardTitle>
      </CardHeader>
      
      {toolId && (
        <>
          <CardContent className="flex flex-col gap-12 p-6 text-sm max-h-[70vh] overflow-y-auto">  
            <div className="grid gap-3">
              <Card>
                <CardHeader>
                          <div className="text-muted-foreground">
                              Test tool
                          </div>                 
                </CardHeader> 
                <CardContent className="flex flex-col gap-3 items-center">
                  <span className="flex flex-row justify-between w-full gap-6">
                    <span className="flex flex-col gap-4 w-1/2">
                      <div className="sticky top-0 bg-white z-10 space-y-4">
                          <div className="flex-1 space-y-4">
                              {Object.entries(inputs).map(([key, field]) => {
                                  // Handle new format: field is an object with name, hint, type, required
                                  const fieldName = typeof field === 'object' && field !== null ? field.name || key : key;
                                  const fieldHint = typeof field === 'object' && field !== null ? field.hint || field : field;
                                  const fieldType = typeof field === 'object' && field !== null ? field.type || 'text' : 'text';
                                  const isRequired = typeof field === 'object' && field !== null ? field.required || false : false;
                                  
                                  return (
                                      <div key={key} className="flex flex-col space-y-2">
                                          <label className="text-sm font-medium text-gray-700">
                                              {fieldHint}
                                              {isRequired && <span className="text-red-500 ml-1">*</span>}
                                          </label>
                                          {fieldType === 'array' || fieldType === 'object' ? (
                                              <Textarea
                                                  value={inputValues[fieldName] || ''}
                                                  onChange={(e) => handleInputChange(fieldName, e.target.value)}
                                                  placeholder={`Enter ${fieldName}`}
                                                  required={isRequired}
                                              />
                                          ) : (
                                              <Input
                                                  type={fieldType}
                                                  value={inputValues[fieldName] || ''}
                                                  onChange={(e) => handleInputChange(fieldName, e.target.value)}
                                                  placeholder={`Enter ${fieldName}`}
                                                  required={isRequired}
                                              />
                                          )}
                                      </div>
                                  );
                              })}
                          </div>
                          <div className="flex-1">
                              Input:
                              <pre className="text-sm bg-gray-100 p-2 rounded whitespace-pre-wrap break-words overflow-x-auto max-w-full">
                                  {JSON.stringify(inputValues, null, 2)}
                              </pre>
                          </div>
                          <TriggerEndpoint
                              path = {`${import.meta.env.VITE_API_URL}/_schd/${portfolio}/${org}/call/${data?.['handler']}`}
                              method = 'POST'
                              payload={inputValues}
                              statusUp={statusTool}
                              captions={captions_troubleshoot}
                              onResponse={handleResponse}
                              onError={handleError}
                          />
                      </div>
                    </span>
                    
                    <div className="flex-1 gap-3">
                        Output:
                        <pre className="text-sm bg-gray-100 p-2 rounded whitespace-pre-wrap break-words overflow-x-auto max-w-full">
                            {JSON.stringify(response, null, 2)}
                        </pre>
                        
                        {errorResponse && (
                        <>
                        Error:
                        <pre className="text-sm bg-gray-100 p-2 rounded whitespace-pre-wrap break-words overflow-x-auto max-w-full">
                            {JSON.stringify(errorResponse, null, 2)}
                        </pre>
                        </>  

                          )}
                    </div>   
                  </span>  
                
                  
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
                                  refreshUp={refreshTool}
                                  blueprint={blueprint}
                                  title='Edit attribute'
                                  instructions={fieldsDictionary[key]?.hint ?? ''}
                                  path={`${import.meta.env.VITE_API_URL}/_data/${portfolio}/${org}/${ring}/${toolId}`}
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