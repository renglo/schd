import { useState, useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import ChatHistory from "@/components/console/chat-history"
import ChatInput from "@/components/console/chat-input"
import { Badge } from "@/components/ui/badge"
import ChatWidgetJson from "@/components/console/chat-widget-json"
import ChatWidgetText from "@/components/console/chat-widget-text"
import ChatWidgetCommand from "@/components/console/chat-widget-command"
import ChatWidgetWorkspace from "@/components/console/chat-widget-workspace"


import { 
  Plus,
  History,
  ChevronDown,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface AgentProps {
  portfolio: string;
  org: string;
  tool: string;
  tree?: { portfolios: Record<string, Portfolio> };
  query?: Record<string, string>;
}

interface Portfolio {
  name: string;
  portfolio_id: string;
  orgs: Record<string, Org>;
  tools: Record<string, Tool>;
}

interface Org {
  name: string;
  org_id: string;
  tools: string[];
}

interface Tool {
  name: string;
  handle: string;
}

interface Message {
  author_id: string;
  time: number;
  is_active: boolean;
  context: Record<string, any>;
  messages: any[];
  tool_invocations: any[];
  irn: string;
}


interface Workspace {
    author_id: string;
    time: number;
    is_active: boolean;
    context: Record<string, any>;
    type: string;
    config: Record<string, any>;
    data: any[];
    irn: string;
  }

export default function SchdLoop({portfolio, org, tool, tree, query}: AgentProps){

    const section = 'a'
    console.log('Loop : Portfolio/Org/Tool/Section/Query',portfolio,org,tool,section,query);
    
    //const entity_type = 'org-tool-section'; // This chat belongs to an org, tool and section in specific
    //const entity_id = `${org}-${tool}-${section}`;

    let sender = '';
    let entity_type = '';
    let entity_id = '';

    if(org == '_all'){
      sender = query?.['sender'] || '0000000000';
      entity_type = 'portfolio-tool-public';
      entity_id = `${portfolio}-${tool}-${sender}`;
    }else if(org){
      sender = '';
      entity_type = 'portfolio-org-tool-section';
      entity_id = `${portfolio}-${org}-${tool}-${section}`;
    }
    

    const [threads, setThreads] = useState({});
    const [messages, setMessages] = useState<Message[]>([]);
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [activeThread, setActiveThread] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(false);
    
    const [isAtBottom, setIsAtBottom] = useState(true);

    // Add effect to scroll to bottom when messages change
    useEffect(() => {
      const messageContainer = document.getElementById('messageContainer');
      if (messageContainer) {
        messageContainer.scrollTop = messageContainer.scrollHeight;
        setIsAtBottom(true);
      }
    }, [messages]);

    useEffect(() => {
      const workspaceContainer = document.getElementById('workspaceContainer');
      if (workspaceContainer) {
        workspaceContainer.scrollTop = workspaceContainer.scrollHeight;
        setIsAtBottom(true);
        setRefreshTrigger(prev => !prev);
      }
    }, [messages]);

    // Get list of threads when org changes
    useEffect(() => {
        const fetchThreads = async () => {
          try {

            // Get list of threads
            const response = await fetch(`${import.meta.env.VITE_API_URL}/_chat/${portfolio}/${org}/${entity_type}/${entity_id}`, {
              method: 'GET',
              headers: { 'Authorization': `Bearer ${sessionStorage.accessToken}` },
            });
            const threads_list = await response.json();
            setThreads(threads_list);
            console.log('Thread list:',threads_list)
            console.log('Testing for userid:',sessionStorage.cu_handle)

            // Find active thread from the list
            const activeT = threads_list.items.find(
              //thread => thread.is_active && thread.author_id === sessionStorage.cu_handle
              thread => thread.is_active
            );

            console.log('Active Thread:',activeT)

            if (activeT) {
              setActiveThread(activeT._id);
            } else {
              // If there is no active thread, create a new one
              const newThreadResponse = await fetch(`${import.meta.env.VITE_API_URL}/_chat/${portfolio}/${org}/${entity_type}/${entity_id}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${sessionStorage.accessToken}` },
              });
              const { success, document } = await newThreadResponse.json();
              if (success) {
                console.log('Created new Thread:',document)
                setActiveThread(document._id);
              }
            }
          } catch (error) {
            console.error('Error fetching threads:', error);
          }
        };
    
        fetchThreads();
    }, [org]);


    // Get messages in original parse or when the active thread changes
    useEffect(() => {

      const fetchMessages = async () => {

        if (!activeThread) {
          return; // Skip if no activeThread
        }

        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL}/_chat/${portfolio}/${org}/${entity_type}/${entity_id}/${activeThread}/messages`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${sessionStorage.accessToken}` },
          });
          const messages_list = await response.json();
          setMessages(messages_list['items']);
          console.log('Messages list:', messages_list['items']);
        } catch (error) {
          console.error('Error fetching messages:', error);
        }
      };
  
      fetchMessages();
    }, [activeThread]);


    // Get workspaces when the thread changes or when a refresh trigger is received
    useEffect(() => {

        const fetchWorkspaces = async () => {
  
          if (!activeThread) {
            return; // Skip if no activeThread
          }
  
          try {

            const response = await fetch(`${import.meta.env.VITE_API_URL}/_chat/${portfolio}/${org}/${entity_type}/${entity_id}/${activeThread}/workspaces`, {
              method: 'GET',
              headers: { 'Authorization': `Bearer ${sessionStorage.accessToken}` },
            });
            const workspaces_list = await response.json();
            setWorkspaces(workspaces_list['items']);
            console.log('Workspaces list:', workspaces_list['items']);
          } catch (error) {
            console.error('Error fetching workspaces:', error);
          }
        };
    
        fetchWorkspaces();
      }, [activeThread, refreshTrigger]);



    // Function to update the state
    const messageAction = (msg: any) => {
      console.log('Chat response:', msg);

      if (msg['type'] === 'rq') {
        console.log('This is an initial request from the user');
        // This is a request (When User sends a request to the Agent)
        const doc = msg['doc'];
        console.log('RQ doc:', doc);
        // Add message to the end of the message roll
        setMessages(prevMessages => [...prevMessages, doc]);
      } else if (msg['type'] === 'rs') {
        console.log('This is a sequential response from the agent');
        // This is a response (When the Agent responds to the User)
        setMessages(prevMessages => {
          if (prevMessages.length > 0) {

            if (!('_out' in msg['update'])) {
                return prevMessages;
            }
            //Retrieve last message from the message roll
            const lastMessage = prevMessages[prevMessages.length - 1];
            console.log('last message:', lastMessage);
            // Append latest update to the message's messages attribute
            const updatedLastMessage = {
              ...lastMessage,
              messages: Array.isArray(lastMessage.messages) 
                ? [...lastMessage.messages, msg['update']]
                : [msg['update']]
            };
            console.log('updated last message:', updatedLastMessage);
            // Create a new array with the updated message
            return [
              ...prevMessages.slice(0, -1),
              updatedLastMessage
            ];
          } else {
            console.log('The message list is empty');
            return prevMessages;
          }
        });
      }
    };

    
    const threadAction = async (switch_thread: any) => {
      if (switch_thread == 'new_thread'){
        const newThreadResponse = await fetch(`${import.meta.env.VITE_API_URL}/_chat/${portfolio}/${org}/${entity_type}/${entity_id}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${sessionStorage.accessToken}` },
        });
        const { success, document } = await newThreadResponse.json();
        if (success) {
          console.log('Created new Thread:',document)
          setMessages([])
          setActiveThread(document._id);
        }
      } else if (switch_thread === 'new_workspace') {
        const newWorkspaceResponse = await fetch(`${import.meta.env.VITE_API_URL}/_chat/${portfolio}/${org}/${entity_type}/${entity_id}/${activeThread}/workspaces`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${sessionStorage.accessToken}` },
        });
        const { success, document } = await newWorkspaceResponse.json();
        if (success) {
          console.log('Created new Workspace:',document)
          // Here you should update the workspaces state to reflect the new workspace
          setActiveThread(activeThread);
          
        }
      } else {
        console.log('Switching to Thread: ', switch_thread);
        setMessages([])
        setActiveThread(switch_thread);
      }
    };

    
    
    const payload_chat_message = {
      'action':'chat_message',
      'portfolio': portfolio,
      'tool': tool,
      'org': org,
      'sender': sender,
      'entity_type': entity_type,
      'entity_id': entity_id,
      'thread': activeThread
    }

        // This is the payload that would come with the Whatsapp message.
    // We are faking it here. 
    /*
        {   
            "app": "DemoApp", 
            "timestamp": 1580227766370,   
            "version": 2, 
            "type": "message",    
            "payload": {  
                "id": "ABEGkYaYVSEEAhAL3SLAWwHKeKrt6s3FKB0c",   
                "source": "918x98xx21x4",   
                "type": "text"|"image"|"file"|"audio"|"video"|"contact"|"location"|"button_reply"|"list_reply", 
                "payload": {    
                // Varies according to the type of payload.    
                },  
                "sender": { 
                "phone": "918x98xx21x4",  
                "name": "Drew",   
                "country_code": "91", 
                "dial_code": "8x98xx21x4" 
                },  
                "context": {    
                "id": "gBEGkYaYVSEEAgnPFrOLcjkFjL8",  
                "gsId": "9b71295f-f7af-4c1f-b2b4-31b4a4867bad"    
                }   
            } 
        }
    */

    let org_label = '';
    if(org =='_all'){
      org_label = '_all';
    }else{
      org_label = tree?.portfolios[portfolio]?.orgs[org]?.name;
    }

    const caption_chat_input = {
      portfolio_name: tree?.portfolios[portfolio]?.name,
      org_name: org_label,
      tool_name: tool ? tree.portfolios[portfolio]?.tools[tool]?.name : undefined,
      section_name: section,
      activeThread: activeThread,
      hint: 'Ask me anything...'
    }


    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const bottom = Math.abs(e.currentTarget.scrollHeight - e.currentTarget.scrollTop - e.currentTarget.clientHeight) < 1;
      setIsAtBottom(bottom);
    };

    return (
      <>
        <PanelGroup direction="horizontal">
          <Panel defaultSize={50} minSize={30}>
            <span className="h-[calc(100vh-80px)] flex flex-col rounded-t-none"> 
              <span className="flex-1 flex flex-col min-h-0 relative">
                {/* Top shadow overlay */}
                <div className="absolute top-0 left-0 right-0 h-8 z-10 pointer-events-none shadow-[inset_0_20px_20px_-10px_rgba(0,0,0,0.3)]" />
                
                {/* Scrollable content */}
                <div
                  className="flex-1 overflow-y-auto relative" 
                  id="workspaceContainer"
                  onScroll={handleScroll}
                > 
                  <div className="relative">
                    {activeThread && (
                      Array.isArray(workspaces) && workspaces.length > 0 ? (
                        workspaces.map((m, index) => (
                          <div key={index} className="flex flex-col mb-4">
                            <div className="mb- hidden">
                              A:{m?.author_id || ' '}
                            </div>
                            <div className="text-sm text-center mt-4 mb-2 text-muted-foreground">
                              {m?.time ? new Date(m.time * 1000).toLocaleString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true
                              }).replace(/(\w+)\s+(\w+)\s+(\d+)\s+at/, '$1, $2 $3 at') : ''}
                            </div>


                              {
                                  m['type'] === 'json' ? (
                                  <ChatWidgetJson
                                      key_id={index}
                                      item={{'_out':m}}
                                      active={index === workspaces.length - 1}
                                  />
                                  ) : m['type'] === 'text' ? (
                                  <ChatWidgetText
                                      key_id={index}
                                      item={{'_out':m}}
                                      active = {true}
                                  />
                                  ) : m['type'] === 'command' ? (
                                  <ChatWidgetCommand
                                      key_id={index}
                                      item={{'_out':m}}
                                      active = {true}
                                  />
                                  ) : (
                                  <ChatWidgetText
                                      key_id={index}
                                      item={{'_out':m}}
                                      active = {true}
                                  />
                                  )
                              }
                            
                          </div>
                        ))
                      ) : (
                          <div className="flex flex-col mb-4 mt-24">
                              <ChatWidgetWorkspace
                              key_id="default"
                              item={{'_out':{'error':'1','message':'Empty Workspace'}}}
                              />
                          </div>
                      )
                    )}
                  </div>
                  
                  {/* Bottom shadow with conditional scroll indicator */}
                  <div className="sticky bottom-0 left-0 right-0 h-6 z-20">
                    <div className="h-full bg-gradient-to-t from-background via-background/20 to-transparent pointer-events-none" />
                    {!isAtBottom && (
                      <div 
                        className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-muted-foreground animate-bounce cursor-pointer hover:text-foreground"
                        onClick={() => {
                          document.getElementById('workspaceContainer')?.scrollTo({
                            top: document.getElementById('workspaceContainer')?.scrollHeight,
                            behavior: 'smooth'
                          });
                        }}
                      >
                        <ChevronDown className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                </div>

              </span>
              
            </span>
          </Panel>

          <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors" />

          <Panel defaultSize={47} minSize={27}>
            <span className="h-[calc(100vh-80px)] flex flex-col rounded-t-none"> 
              <span className="flex-1 flex flex-col min-h-0 relative">
                {/* Top shadow overlay */}
                <div className="absolute top-0 left-0 right-0 h-8 z-10 pointer-events-none shadow-[inset_0_20px_20px_-10px_rgba(0,0,0,0.3)]" />
                
                {/* Scrollable content */}
                <div 
                  className="flex-1 overflow-y-auto relative" 
                  id="messageContainer"
                  onScroll={handleScroll}
                >
                  <div className="relative">
                    {activeThread && Array.isArray(messages) && messages.map((m, index) => (
                      <div key={index} className="flex flex-col mb-4">
                        <div className="mb- hidden">
                          A:{m?.author_id || ' '}
                        </div>
                        <div className="text-sm text-center mt-4 mb-2 text-muted-foreground">
                          {m?.time ? new Date(m.time * 1000).toLocaleString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          }).replace(/(\w+)\s+(\w+)\s+(\d+)\s+at/, '$1, $2 $3 at') : ''}
                        </div>
                        <div className="p-4 rounded-xl bg-muted mb-4 flex flex-col self-end max-w-[80%]">
                          {m?.messages[0]?._out?.content || JSON.stringify(m.messages[0])}
                        </div>

                        {Array.isArray(m.messages) && m.messages.slice(1).map((item, idx) => (
                          item['_type'] === 'json' ? (
                            <ChatWidgetJson
                              key_id={idx}
                              item={item}
                              active={true}
                            />
                          ) : item['_type'] === 'text' ? (
                            <ChatWidgetText
                              key_id={idx}
                              item={item}
                            />
                          ) : item['_type'] === 'command' ? (
                            <ChatWidgetCommand
                              key_id={idx}
                              item={item}
                            />
                          ) : (item['_type'] === 'tool_rs' ) ? (
                            <>
                              <span className="block text-center py-10">[PLACEHOLDER: SPECIALIZED WIDGET]</span>
                            </>
                          ) : (
                            <ChatWidgetText
                              key_id={idx}
                              item={item}
                            />
                          )
                        ))}
                        
                      </div>
                    ))}
                  </div>
                  
                  {/* Bottom shadow with conditional scroll indicator */}
                  <div className="sticky bottom-0 left-0 right-0 h-6 z-20">
                    <div className="h-full bg-gradient-to-t from-background via-background/20 to-transparent pointer-events-none" />
                    {!isAtBottom && (
                      <div 
                        className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-muted-foreground animate-bounce cursor-pointer hover:text-foreground"
                        onClick={() => {
                          document.getElementById('messageContainer')?.scrollTo({
                            top: document.getElementById('messageContainer')?.scrollHeight,
                            behavior: 'smooth'
                          });
                        }}
                      >
                        <ChevronDown className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Input area */}
                
                <ChatInput
                  messageUp = {messageAction}
                  payload = {payload_chat_message}
                  captions = {caption_chat_input}
                />

              </span>
              
            </span>
          </Panel>

          <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors" />

          <Panel defaultSize={3} minSize={3} maxSize={3}>
            <span className="h-[calc(100vh-80px)] flex flex-col overflow-y-auto border-l"> 
              <ChatHistory
                history={threads}
                actionUp={threadAction}
              />
            </span>
          </Panel>
        </PanelGroup>
      </> 
    )
}