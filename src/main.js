const core = require('@actions/core');
const axios = require('axios');
const { createChange } = require('./lib/create-change');
const { tryFetch } = require('./lib/try-fetch');

const main = async() => {
  try {
    const instanceUrl = core.getInput('instance-url', { required: true });
    const toolId = core.getInput('tool-id', { required: true });
    const username = core.getInput('devops-integration-user-name', { required: false });
    const passwd = core.getInput('devops-integration-user-password', { required: false });
    const token = core.getInput('devops-integration-token', { required: false });
    const jobname = core.getInput('job-name', { required: true });
    const deploymentGateStr = core.getInput('deployment-gate', { required: false });

    let changeRequestDetailsStr = core.getInput('change-request', { required: false });
    let githubContextStr = core.getInput('context-github', { required: true });

    let abortOnChangeCreationFailure = core.getInput('abortOnChangeCreationFailure');
    abortOnChangeCreationFailure = abortOnChangeCreationFailure === undefined || abortOnChangeCreationFailure === "" ? true : (abortOnChangeCreationFailure == "true");

    /**
     * If timeout/changeCreationTimeOut is not provided by user, we will default it to 3600seconds.
     * If timeout/changeCreationTimeOut is provided by user, we will consider the user input if the value is more than 100sec.Otherwise, will default to 100seconds.
     * It is advisable to have changeCreationTimeOut value < timeout value
     */
    let changeCreationTimeOut = parseInt(core.getInput('changeCreationTimeOut') || 3600);
    changeCreationTimeOut = changeCreationTimeOut >= 100 ? changeCreationTimeOut : 100;

    let status = true;
    let response;

    try {
      response = await createChange({
        instanceUrl,
        toolId,
        username,
        passwd,
        token,
        jobname,
        githubContextStr,
        changeRequestDetailsStr,
        deploymentGateStr
      });
    } catch (err) {
      if (abortOnChangeCreationFailure) {
        status = false;
        core.setFailed(err.message);
      }
      else { 
        console.error("creation failed with error message ," + err.message);
        console.log('\n  \x1b[38;5;214m Workflow will continue executing the next step as abortOnChangeCreationFailure is ' + abortOnChangeCreationFailure + '\x1b[38;5;214m');
        return;
      }
    }

    if (deploymentGateStr)
      status = false; //do not poll to check for deployment gate feature

    if (status) {
      let timeout = parseInt(core.getInput('timeout') || 3600);
      let interval = parseInt(core.getInput('interval') || 100);

      interval = interval>=100 ? interval : 100;
      timeout = timeout>=100? timeout : 100;

      let abortOnChangeStepTimeout = core.getInput('abortOnChangeStepTimeout');
      abortOnChangeStepTimeout = abortOnChangeStepTimeout === undefined || abortOnChangeStepTimeout === "" ? false : (abortOnChangeStepTimeout == "true");

      let start = +new Date();
      let changeCreationStartTime = +new Date();
      let prevPollChangeDetails = {};

      response = await tryFetch({
        start,
        interval,
        timeout,
        instanceUrl,
        toolId,
        username,
        passwd,
        token,
        jobname,
        githubContextStr,
        abortOnChangeStepTimeout,
        prevPollChangeDetails,
        changeCreationTimeOut,
        abortOnChangeCreationFailure,
        changeCreationStartTime
      });

    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

main();