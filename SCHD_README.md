# SCHD TOOL

### ONE TIME INSTALLATION
Note: You just need to perform this step only once when installing the tool in the environment (not every time a new user is created).


1. Environment installation. 

Go to the tool installer folder and run the upload_blueprints.py. This will install all the blueprints needed to operate the game

`cd tools/schd/installer`
`python upload_blueprints.py maker --aws-profile maker --aws-region us-east-1`

This will create in the database as many blueprints as there are json documents in the /blueprints folder


2. Declare the tool in the tools manifest

Open the tool manifest and list the tool 
`vim tower/src/tools.json`

If you want the tool installer to show up to new users after they have created their account, list `maker` as the bootstrap value


Example: 
{
  "tools":{
    "data": "1.0.0",
    "schd": "1.0.0",
    "maker": "1.0.0"
  },
  "bootstrap":"maker"
}


3. Install pip Requirements for the Tool

Check the requirements.txt file and add the openai requirement if it isn't here

`cd tank`
`vim requirements.txt`

Add this
`openai==1.65.2`


If you are in dev, run this. 
`pip install openai`


4. Run the Onboarding script that creates the entities


