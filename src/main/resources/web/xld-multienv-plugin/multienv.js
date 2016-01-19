var multienvApp = angular.module('MultienvApp', ['ui.bootstrap']);

multienvApp.config(function ($httpProvider) {
    // The following code retrieves credentials from the main XL Deploy application
    // and tells AngularJS to append them to every request.
    var flexApp = parent.document.getElementById("flexApplication");
    if (flexApp) $httpProvider.defaults.headers.common.Authorization = flexApp.getBasicAuth();
});


multienvApp.factory('deploymentService', ['$http', '$q', function ($http, $q) {
    return {
        deployment_prepare_update: function (version, deployedApplication) {
            var request = {
                url: '/deployit/deployment/prepare/update',
                method: "GET",
                params: {'version': version, 'deployedApplication': deployedApplication},
                headers: {
                    'Accept-Type': 'application/xml',
                    'Accept': 'application/xml',
                    'Content-Type': 'application/xml'
                }
            }
            return $http(request).then(
                function (response) {
                    return response.data
                }
            );
        },
        deployment_prepare_all_deployed: function (deployment) {
            return $http.post('/deployit/deployment/prepare/deployeds', deployment, {
                headers: {
                    'Accept-Type': 'application/xml',
                    'Accept': 'application/xml',
                    'Content-Type': 'application/xml'
                }
            }).then(
                function (response) {
                    return response.data
                }
            );
        },
        deployment_validate: function (deployment) {
            return $http.post('/deployit/deployment/validate', deployment, {
                headers: {
                    'Accept-Type': 'application/xml',
                    'Accept': 'application/xml',
                    'Content-Type': 'application/xml'
                }
            }).then(
                function (response) {
                    return response.data
                }
            );
        },
        deployment_create_task: function (deployment) {
            return $http.post('/deployit/deployment', deployment, {
                headers: {
                    'Accept-Type': 'application/xml',
                    'Accept': 'application/xml',
                    'Content-Type': 'application/xml'
                }
            }).then(
                function (response) {
                    return response.data
                }
            );
        },
        start_task: function (task_id) {
            var url = "/deployit/tasks/v2/".concat(task_id, '/start')
            return $http.post(url, {
                headers: {
                    'Accept-Type': 'application/xml',
                    'Accept': 'application/xml',
                    'Content-Type': 'application/xml'
                }
            }).then(
                function (response) {
                    return response.data
                }
            );
        },


    };
}]);

multienvApp.factory('repositoryQueryBuilder', function () {
    var QueryBuilder = function () {

        var query = {params: {resultsPerPage: -1}};

        this.withType = function (type) {
            if (type) {
                query.params.type = type;
            }
            return this;
        };

        this.withParent = function (parent) {
            if (parent) {
                query.params.parent = parent;
            }
            return this;
        };

        this.withAncestor = function (ancestor) {
            if (ancestor) {
                query.params.ancestor = ancestor;
            }
            return this;
        };

        this.withNamePattern = function (namePattern) {
            if (namePattern) {
                query.params.namePattern = '%' + namePattern + '%';
            }
            return this;
        };

        this.startingWithNamePattern = function (namePattern) {
            if (namePattern) {
                query.params.namePattern = namePattern + '%';
            }
            return this;
        };

        this.query = function () {
            return query;
        };
    };

    var newQueryBuilder = function () {
        return new QueryBuilder();
    };

    return {
        newQueryBuilder: newQueryBuilder
    };
})


multienvApp.factory('multienvService', ['$http', '$q', 'repositoryQueryBuilder', 'deploymentService', function ($http, $q, repositoryQueryBuilder, deploymentService) {
    return {
        queryRepository: function (query) {
            return $http.get('/deployit/repository/query', query).then(
                function (response) {
                    return response.data
                }
            );
        },
        findAllApplications: function () {
            var query = repositoryQueryBuilder.newQueryBuilder()
                .withType('udm.Application')
                .query();
            return this.queryRepository(query);
        },
        findAllVersions: function (application) {
            var query = repositoryQueryBuilder.newQueryBuilder()
                .withParent(application)
                .query();
            return this.queryRepository(query);
        },
        getDeployedApplications: function (application) {
            return $http.get('/api/extension/xld-multienv-plugin/deployed-applications', {"params": {"application": application}}).then(
                function (response) {
                    return response.data.entity;
                }
            );
        },
        archive_task: function (task_id) {
            var url = "/deployit/tasks/v2/".concat(task_id, '/archive')
            return $http.post(url);
        },
        cancel_task: function (task_id) {
            return $http(
                {
                    url: "/deployit/tasks/v2/".concat(task_id),
                    method: 'DELETE'
                });
        },
        deploy: function (version, deployedApplication) {
            return deploymentService.deployment_prepare_update(version.ref, deployedApplication)
                .then(function (deployment) {
                    return deploymentService.deployment_prepare_all_deployed(deployment)
                })
                .then(function (deployment) {
                    return deploymentService.deployment_validate(deployment)
                })
                .then(function (deployment) {
                    return deploymentService.deployment_create_task(deployment)
                })
                .then(function (taskid) {
                    deploymentService.start_task(taskid)
                    return taskid
                })
        }
    }
}]);

multienvApp.controller('ShowDeploymentController', ['$scope', '$uibModalInstance', 'deployedApplications', 'version', 'multienvService', function ($scope, $uibModalInstance, deployedApplications, version, multienvService) {
    $scope.deployedApplications = deployedApplications;
    $scope.version = version;

    $scope.start_deployments = function () {
        var dummy_task_info = {
            task_id: 'XXX-YYY-ZZZ',
            state: 'STARTING',
            version: version,
        }
        for (var i in $scope.deployedApplications) {
            multienvService.deploy(version, $scope.deployedApplications[i].deployed_application_id)
            $scope.deployedApplications[i].task_info = dummy_task_info
        }
        $uibModalInstance.close();
    };

    $scope.cancel_deployments = function () {
        $uibModalInstance.dismiss();
    };
}]);

multienvApp.controller('MultienvController', ['$scope', '$uibModal', '$filter', 'multienvService', function ($scope, $uibModal, $filter, multienvService) {
    $scope.loadApplications = function () {
        multienvService.findAllApplications().then(function (applications) {
            $scope.applications = applications
            $scope.deployedApplications = []
            $scope.versions = []
        });
    }

    $scope.loadVersions = function () {
        multienvService.findAllVersions($scope.application.ref)
            .then(function (versions) {
                $scope.versions = versions
            })
            .then(angular.bind(this, multienvService.getDeployedApplications, $scope.application))
            .then(function (deployedApplications) {
                $scope.deployedApplications = deployedApplications

            });
    }

    $scope.loadApplications()

    $scope.sortType = 'environment'; // set the default sort type
    $scope.sortReverse = false;  // set the default sort order
    $scope.filterEnv = '';     // set the default search/filter term
    $scope.task_ids = []

    $scope.updateSelected = function () {
        for (var i in $scope.visibleDeployedApps) {
            $scope.visibleDeployedApps[i].selected = true;
        }
    }

    $scope.showDeployments = function (deployedApplications, version) {
        var filtered = $filter('filter')(deployedApplications, {selected: true});
        var modalInstance = $uibModal.open({
            animation: true,
            templateUrl: 'showDeployments.html',
            controller: 'ShowDeploymentController',
            size: 'lg',
            scope: $scope,
            resolve: {
                deployedApplications: function () {
                    return filtered;
                },
                version: function () {
                    return version;
                }
            }
        });

        modalInstance.result.finally(function () {
            $scope.loadVersions()
        });

    };

    $scope.close_task = function (task) {
        multienvService.archive_task(task.task_id).then(function () {
            $scope.loadVersions()
        })
    }

    $scope.cancel_task = function (task) {
        multienvService.cancel_task(task.task_id).then(function () {
            $scope.loadVersions()
        })
    }

}]);
