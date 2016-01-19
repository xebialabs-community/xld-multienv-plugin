import json


def to_json(data):
    return json.loads(data)


def to_task_info(task):
    return {'state': str(task.state), 'task_id': task.id, 'version': task.metadata['version'], 'environment_id': task.metadata['environment_id']}


def get_running_tasks(application_name):
    app_tasks = filter(lambda task: task.metadata['application'] == application_name, taskBlockService.allCurrentTasks)
    app_running_tasks = {}
    for task in app_tasks:
        info = to_task_info(task)
        app_running_tasks[info['environment_id']] = info
    return app_running_tasks


application = to_json(request.query["application"])

deployed_applications = []
if application:
    app_name = application['ref'].split('/')[-1]
    running_tasks = get_running_tasks(app_name)

    # Retrieve a list of deployed applications
    deployed_app_ids = repositoryService.query(Type.valueOf("udm.DeployedApplication"), None, "Environments/", app_name, None, None, 0, -1)
    for deployed_app_id in deployed_app_ids:
        # Retrieve actual deployed application
        deployed_app = repositoryService.read(deployed_app_id.id)


        # Check if we have the correct application.
        # We need to do this, because the ID of the deployed application ONLY
        # uses the last part of the name... If we would have two application with
        # the same name in different folders, they would otherwise both show up here.
        # To work around this we can use the ID of the referenced version ID.
        if deployed_app.version.id.startswith(application['ref']):
            env_id = deployed_app.id.rsplit('/', 1)[0]
            version = deployed_app.version.id

            task_info = {}
            if env_id in running_tasks:
                task_info = running_tasks[env_id]

            env = repositoryService.read(env_id)

            deployed_applications.append({
                "environment": env_id,
                "datacenter": env.datacenter,
                "version_id": deployed_app.version.id,
                "version_name": deployed_app.version.name,
                "deployed_application_id": deployed_app_id.id,
                "selected": False,
                "task_info": task_info
            })

response.entity = deployed_applications
