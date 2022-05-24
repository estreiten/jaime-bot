### What is this?
It's a bot used by the [Jaime Manager](https://github.com/estreiten/jaime) to run tasks in remote workstations.<br>
It has no graphical interface, but runs in a web server waiting for instructions from its Jaime parent.

### Installation
1. Install dependencies with ``npm install``
2. Copy `config.example.js` to `config.js`
3. Replace by the corresponding values in `config.js`.<br>
  Your environments must be set in the `config.js` file following the convention in the next example:

    ```
    env: {
      qa: {
        branch: 'release-',
        branchStart: true,
        path: '/home/project-qa'
      }
    }
    ```
    where: 
      - ``qa`` is your environment's name
      - ``branch`` is the Github's branch that will be deployed
      - ``branchStart`` determines that you only compare the ``branch`` string with the beginning of the branch pushed
      - ``path`` is the folder of your environment in the machine

4. You have to create a folder for your environments' scripts and logs, following the next convention:

    - create the ``env`` folder inside this projects root.
    - create a folder for each environment's name configured in the step above.
    - create a folder ``logs`` inside each environment's folder.
    - if your environment has a build script, create the ``build.sh`` file inside the environment's folder.
    - if your environment has a post-build script, create the ``post.sh`` file inside the environment's folder.

    For example: the ``qa`` environment has both build and post-build scripts. So the next structure was created:
    ````
    /env/qa/
    ---- build.sh
    ---- post.sh
    ---- logs/
    ````

    Note: make sure that the script files have the corresponding permissions to be executed by Jaime.
5. Assure that the ``update.sh`` script in the Jaime root has execute permissions for the user that will start Jaime.
6. Run with `npm start` and wait for the Github push hooks.

--------------

### Script parameters
When triggered by a Github push hook, the scripts will receive two parameters:
 1. the name of the branch updated
 2. the path of the output log
When triggered manually, the scripts will receive one parameter:
 1. the path of the output log
  It won't receive the updated branch here, since the update won't imply any branch change.

### Custom actions
To specify custom actions in the app, you have to create a special folder at the root of the project called ``actions``.<br>
The actions are buttons in the Jaime Manager board, with the action name inside them, that will trigger a specific script file.<br>
For example, in the `config.js` file:

    actions: [
      {
        name: 'Play music',
        script: 'play.sh'
      }
    ]

  when clicking the "Play music" button in the Jaime Manager board, it will trigger the ``play.sh`` script located inside the ``actions`` folder in the root of the project.