import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
  } from "@/components/ui/card"
  
  import { useState, useEffect} from 'react';
  import DialogPost from "@/components/tank/dialog-post"
  
  interface Blueprint {
      label: string;
      // Add other properties as needed
      [key: string]: any; // This allows for additional dynamic properties if necessary
  }
  
  interface TreeStructure {
      portfolios: {
          [key: string]: {
              name: string;
              portfolio_id: string;
              orgs: object;
              teams: object;
              tools: object;
          }
      };
      user_id: string;
  }
  
  interface SchdOnboardingProps {
      tree: TreeStructure;
  }

  const raw_blueprint = {
    "_id": "5e834ed5-d532-4852-a20f-290192019ab23",
    "added": "2025-02-06T09:22:46.229773",
    "blueprint_origin": "",
    "description": "Onboarding for Scheduler",
    "fields": [
        {
            "cardinality": "single",
            "default": "",
            "hint": "Portfolio this handle should belong to",
            "label": "Portfolio",
            "layer": "2",
            "multilingual": false,
            "name": "portfolio",
            "order": "2",
            "required": false,
            "semantic": "hs:portfolio",
            "source": "",
            "type": "string",
            "widget": "text"
        },
        {
            "cardinality": "single",
            "default": "",
            "hint": "Org the app should belong to",
            "label": "Org",
            "layer": "2",
            "multilingual": false,
            "name": "org",
            "order": "3",
            "required": false,
            "semantic": "hs:org",
            "source": "",
            "type": "string",
            "widget": "text"
        },
        {
            "cardinality": "single",
            "default": "Admin",
            "hint": "Team the main user should belong to",
            "label": "Team",
            "layer": "2",
            "multilingual": false,
            "name": "team",
            "order": "4",
            "required": false,
            "semantic": "hs:team",
            "source": "",
            "type": "string",
            "widget": "text"
        },
        {
            "cardinality": "single",
            "default": "",
            "hint": "Tool the user is getting onboarded to",
            "label": "Tool",
            "layer": "2",
            "multilingual": false,
            "name": "tool",
            "order": "5",
            "required": false,
            "semantic": "hs:tool",
            "source": "",
            "type": "string",
            "widget": "text"
        },
        {
            "cardinality": "single",
            "default": "16",
            "hint": "How often should the agent run an operational cycle?",
            "label": "Refresh Rate (minutes)",
            "layer": "0",
            "multilingual": false,
            "name": "refresh_rate",
            "order": "6",
            "required": false,
            "semantic": "hs:refresh",
            "type": "string",
            "widget": "text"
        }
      ],
      "handle": "irma",
      "irn": "irn:blueprint:irma:maker_onboardings",
      "label": "Maker Onboardings",
      "license": "CC BY",
      "name": "maker_onboardings",
      "public": true,
      "singleton": false,
      "status": "final",
      "uri": "https://tank7075.helloirma.com/_blueprint/irma/maker_onboardings/1.0.1",
      "version": "0.0.1"
  }
  
  export default function SchdOnboarding({ tree }: SchdOnboardingProps) {
  
      const [blueprint, setBlueprint] = useState<Blueprint>({ label: '' });
      const [modifiedBlueprint, setModifiedBlueprint] = useState<Blueprint>({ label: '' });
      const [error, setError] = useState<Error | null>(null);

      console.log(tree)

      
      useEffect(() => {

  
        {
        const fetchBlueprint = async () => {
          try {
            // Fetch Blueprint
            const blueprintResponse = await fetch(`${import.meta.env.VITE_API_URL}/_blueprint/irma/schd_onboardings/last`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${sessionStorage.accessToken}`,
              },
            });
            const blueprintData = await blueprintResponse.json();
            //const blueprintData = raw_blueprint;
            setBlueprint(blueprintData);
            setModifiedBlueprint({ ...blueprintData }); // Create a shallow copy of the blueprint data
            

          } catch (err) {

            if (err instanceof Error) {
              setError(err);  // Now TypeScript knows `err` is of type `Error`.
            } else {
              setError(new Error("An unknown error occurred"));  // Handle other types
            }
            console.log(error)
          }
        };
  
        fetchBlueprint();
        }

      }, []);

      useEffect(() => {
        if (tree && tree.portfolios && blueprint && blueprint.fields) {
            // Create portfolio dictionary from the object
            const portfolio_dict: { [key: string]: string } = {};
            const portfolio_orgs_dict: { [key: string]: any } = {};
            const portfolio_teams_dict: { [key: string]: any } = {};
            Object.entries(tree.portfolios).forEach(([portfolioId, portfolio]) => {
                portfolio_dict[portfolioId] = portfolio.name;
                //portfolio_orgs_dict[portfolioId] = {};
                //portfolio_teams_dict[portfolioId] = {};
                //Object.entries(portfolio.orgs).forEach(([orgId, org]: [string, any]) => {
                //    portfolio_orgs_dict[portfolioId][orgId] = org.name;
                //});
                //Object.entries(portfolio.teams).forEach(([teamId, team]: [string, any]) => {
                //    portfolio_teams_dict[portfolioId][teamId] = team.name;
                //});
            });

            // const teams_dict: { [portfolioId: string]: { [teamId: string]: string } } = {};
            // Object.values(tree.portfolios).forEach(portfolio => {
            //     teams_dict[portfolio.portfolio_id] = {};
            //     Object.entries(portfolio.teams).forEach(([teamId, team]) => {
            //         teams_dict[portfolio.portfolio_id][teamId] = team.name;
            //     });
            // });

            const updatedBlueprint = {
                ...modifiedBlueprint,
                fields: modifiedBlueprint.fields.map(field => {
                    
                    if (field.name === 'portfolio') {
                        return {
                            ...field,
                            layer: '0',
                            options: portfolio_dict,
                            widget: 'select',
                            required: true
                        };
                    }

                    //if (field.name === 'org') {
                    //    return {
                    //        ...field,
                    //        layer: '0',
                    //        options: portfolio_orgs_dict,
                    //        widget: 'select',
                    //        required: true
                    //    };
                    //}

                    //if (field.name === 'team') {
                    //    return {
                    //        ...field,
                    //        layer: '0',
                    //        options: portfolio_orgs_dict,
                    //        widget: 'select',
                    //        required: true
                    //    };
                    //}

                    

                    return field;
                })
            };
            console.log('updatedBlueprint:',updatedBlueprint);
            setModifiedBlueprint(updatedBlueprint);
        }
      }, [tree, blueprint]); // Add both dependencies

      // Function to update the state
      const refreshAction = () => {
  
      };
  
      // Check if portfolio options are available
      const portfolioField = modifiedBlueprint.fields?.find(field => field.name === 'portfolio');
      const hasPortfolioOptions = portfolioField?.options && Object.keys(portfolioField.options).length > 0;
  
      return (
     
        <>
          <Card>
            <CardHeader>
              <CardTitle>Scheduler App</CardTitle>
              <CardDescription>
                      This app helps you configure the agent.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
            
              

              <div className="flex flex-row gap-3 text-xs text-muted-foreground">
                <div>This will install the app in an existing portfolio </div>
                {hasPortfolioOptions ? (
                  <DialogPost
                      refreshUp={refreshAction}
                      blueprint={modifiedBlueprint}
                      title={`Activate your portfolio`}
                      instructions="Please fill the following fields:"
                      path={`${import.meta.env.VITE_API_URL}/_schd/run/schd/schd_onboardings`}
                      method='POST'
                      buttontext='Install'
                  />
                ) : (
                  <div className="text-red-500 font-medium">
                    No portfolio(s) available. Create one first.
                  </div>
                )}
              </div>             
            </CardContent>             
          </Card> 
          
          
        </>
      
      )
  }
  