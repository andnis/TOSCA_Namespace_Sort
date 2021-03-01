var path = require('path')
var fs = require('fs')
var xml2js = require('xml2js');

const chalk = require('chalk');
const colors = require("ansi-colors");

const Store = require('data-store');
const {
    prompt
} = require('enquirer');

const jsonfind = require("json-nested-find");
const {
    resolve
} = require('path');

let config = {
    path: "E:\\TOSCA\\tosca-definitions-internal\\",
    destPath: "file://tmp/copybara/tosca-definitions-public"
}

let repositoryChoicesAdd, repositoryChoices

let counter = {}

let definitions = {}

let repositories = {
    unsorted: {
        definitions: [],
        dependencies: [],
        namespace: ""
    },
}

const referenceTags = ["typeRef", "type", "artifactRef", "nodeType", "artifactType", "capabilityType"]

const types = ["NodeType", "ServiceTemplate", "ArtifactTemplate", "ArtifactType", "CapabilityType", "ComplianceRule", "NodeTypeImplementation", "PolicyTemplate", "PolicyType", "RelationshipType", "RequirementType", "PatternRefinementModel"]

function findInDir(dir, filter, fileList = []) {
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
        const filePath = path.join(dir, file);
        const fileStat = fs.lstatSync(filePath);

        if (fileStat.isDirectory()) {
            findInDir(filePath, filter, fileList);
        } else if (filter.test(filePath)) {
            fileList.push(filePath);
        }
    });

    return fileList;
}

function checkFile(file) {
    return new Promise((resolve, reject) => {
        var parser = new xml2js.Parser();
        fs.readFile(file, function (err, data) {
            parser.parseString(data, function (err, result) {

                const directoryOfDefinition = file.substring(0, file.lastIndexOf('\\'))

                const definitionRefs = ["Definitions", "tosca:Definitions"]

                let name

                for (const definition of definitionRefs) {
                    if (result[definition]) {

                        for (const type of types) {
                            if (result[definition][type]) {

                                name = result[definition][type][0]["$"].name || result[definition][type][0]["$"].id

                                definitions[name] = {};

                                definitions[name].dependencies = [];
                                definitions[name].implementations = [];

                                definitions[name].directory = directoryOfDefinition

                                definitions[name].type = type

                                definitions[name].namespace = result[definition]["$"].targetNamespace

                                if (name == "Pet-Clinic-DA_w1" || name == "Mosquitto_3.1_1-w1-wip1" || name == "string") {
                                    console.log(definitions[name])
                                }


                            } else if (result[definition]["tosca:" + type]) {
                                name = result[definition]["tosca:" + type][0]["$"].name || result[definition]["tosca:" + type][0]["$"].id

                                definitions[name] = {};

                                definitions[name].dependencies = [];
                                definitions[name].implementations = [];
                                //definitions[name].dependent = [];

                                definitions[name].directory = directoryOfDefinition

                                definitions[name].type = type

                                definitions[name].namespace = result[definition]["$"].targetNamespace

                                if (name == "Pet-Clinic-DA_w1" || name == "Mosquitto_3.1_1-w1-wip1" || name == "string") {
                                    console.log(definitions[name])
                                }

                            }
                        }

                    }
                }

                if (name) {

                    repositories.unsorted.definitions.push(name)

                }


                for (const tag of referenceTags) {
                    const referenceTag = jsonfind.All(result, tag);

                    for (const reference of referenceTag) {
                        const words = reference.split(":")
                        if (words[1]) {

                            if (name) {
                                definitions[name].dependencies.push(words[1])
                            }

                            if (counter[words[1]]) {
                                counter[words[1]] = counter[words[1]] + 1
                            } else {
                                counter[words[1]] = 1
                            }
                        } else {

                            if (name) {
                                definitions[name].dependencies.push(words[0])
                            }

                            if (counter[words[0]]) {
                                counter[words[0]] = counter[words[0]] + 1
                            } else {
                                counter[words[0]] = 1
                            }
                        }

                    }
                }

                resolve()
            });
        });
    })
}


function findDependencies(definition, dependencies, implementations) {

    dependencies = dependencies || new Set();

    let currentDef

    if (definitions[definition]) {

        currentDef = definitions[definition].dependencies
        if (implementations) {
            if (definitions[definition].type === "NodeType") {
                for (const impl of definitions[definition].implementations) {
                    currentDef.push(impl)
                }
            }
        }

        if (currentDef != undefined) {
            for (const dependency of currentDef) {
                if (!dependencies.has(dependency)) {
                    dependencies.add(dependency)
                    for (const dep of findDependencies(dependency, dependencies)) {
                        dependencies.add(dep);
                    }
                }
            }
        } else {
        }


    } else {

    }

    return dependencies

}

function saveData(data, path) {
    fs.writeFileSync(path, data, (err) => {
        if (err) throw err;
        console.log('Data written to ' + path);
    });
}

function saveAllData() {
    saveData(JSON.stringify(counter, null, 2), "sort/counter.json")
    saveData(JSON.stringify(definitions, null, 2), "sort/definitions.json")
    saveData(JSON.stringify(repositories, null, 2), "sort/repositories.json")
}

function readData(path) {

    let rawdata = fs.readFileSync(path);
    return JSON.parse(rawdata);

}

function readAllData() {

    if (fs.existsSync("config.json")) {
        repositories = readData("config.json")
    } else {
        saveData(JSON.stringify(config, null, 2), "config.json")
    }

    try {
        if (fs.existsSync("sort")) {
            if (fs.existsSync("sort/counter.json")) {
                counter = readData("sort/counter.json")
            } else {
                saveData(JSON.stringify(counter, null, 2), "sort/counter.json")
            }
            if (fs.existsSync("sort/counter.json")) {
                definitions = readData("sort/definitions.json")
            } else {
                saveData(JSON.stringify(definitions, null, 2), "sort/definitions.json")
            }
            if (fs.existsSync("sort/counter.json")) {
                repositories = readData("sort/repositories.json")
            } else {
                saveData(JSON.stringify(repositories, null, 2), "sort/repositories.json")
            }
        } else {
            fs.mkdirSync("sort");
            saveData(JSON.stringify(counter, null, 2), "sort/counter.json")
            saveData(JSON.stringify(definitions, null, 2), "sort/definitions.json")
            saveData(JSON.stringify(repositories, null, 2), "sort/repositories.json")
        }
    } catch (err) {
        console.error(err)
    }

    getRepositoryChoices()
}

function getRepositoryChoices() {
    repositoryChoices = []
    for (const repository of Object.keys(repositories)) {
        repositoryChoices.push({
            name: repository,
            message: repository + " [" + repositories[repository].namespace + "] (" + repositories[repository].definitions.length + ") -> [" + repositories[repository].dependencies + "] ",
            value: repository
        })
    }

    repositoryChoicesAdd = []

    repositoryChoicesAdd.push(...repositoryChoices)

    repositoryChoicesAdd.push({
        name: "[New Repository]",
        message: "[New Repository]",
        value: "[New Repository]"
    })
}

async function analyzeRepo() {
    counter = {}

    definitions = {}

    repositories = {}

    repositories = {
        /* normative: {
            definitions: [],
            dependencies: []
        },
        oftenUsed: {
            definitions: [],
            dependencies: []
        },
        rarelyUsed: {
            definitions: [],
            dependencies: []
        },*/
        unsorted: {
            definitions: [],
            dependencies: [],
            namespace: "http://opentosca.org"
        },
    }
    ext_file_list = findInDir(config.path, /\.tosca$/)

    for (const file of ext_file_list) {
        await checkFile(file);
    }

    for (const definition in definitions) {
        if (definitions[definition].type === "NodeTypeImplementation") {
            for (const dependency of definitions[definition].dependencies) {
                if (definitions[dependency]) {
                    if (definitions[dependency].type === "NodeType") {
                        definitions[dependency].implementations.push(definition)
                    }
                }
            }
        }
    }

    getRepositoryChoices()
}

function moveDefinition(def, repo) {

    let repoCur;

    for (const repository in repositories) {
        if (repositories[repository].definitions.includes(def)) {
            repoCur = repository
        }
    }

    for (var i = 0; i < repositories[repoCur].definitions.length; i++) {

        if (repositories[repoCur].definitions[i] === def) {

            repositories[repoCur].definitions.splice(i, 1);
        }

    }

    repositories[repo].definitions.push(def)

    definitions[def].namespace = repositories[repo].namespace + "/" + definitions[def].type.toLowerCase() + "s"

    getRepositoryChoices()

    console.log(chalk.green(`${def} [${chalk.magenta.bgWhite(definitions[def].type)}] moved to ${repo}`))
}

function printDependencies(definition) {
    let repo;

    for (const repository in repositories) {
        if (repositories[repository].definitions.includes(definition)) {
            repo = repository
        }
    }

    console.log("")
    console.log(definition + " [" + repo + "]")
    console.log("--------------------------------------------------")

    console.log("Dependencies:")

    for (const dependency of definitions[definition].dependencies) {

        let repo;

        for (const repository in repositories) {
            if (repositories[repository].definitions.includes(dependency)) {
                repo = repository
            }
        }

        console.log(dependency + " [" + chalk.magenta.bgWhite(definitions[dependency].type) + "]" + " [" + repo + "]")
    }
    console.log("--------------------------------------------------")
}

async function sortRepositories(defs) {

    let defsToCheck

    if (defs) {
        defsToCheck = defs;
    } else {
        defsToCheck = repositories.unsorted.definitions
    }

    let selection

    selection = await prompt([{
        type: "multiselect",
        name: "definitions",
        limit: 10,
        message: 'Which definitions do you want to move?',
        choices: defsToCheck,
        indicator(state, choice) {
            return choice.enabled ? " " + colors.green("●") : " " + colors.gray("o");
        }
    }, {
        type: "confirm",
        name: "all",
        message: 'Move all definitions at once?'
    }])

    if (selection.all) {

        destination = await prompt({
            type: "select",
            name: "repository",
            message: 'Where do you want to move these Definitions?',
            choices: repositoryChoicesAdd
        });

        let repository = destination.repository
        if (destination.repository == "[New Repository]") {
            repository = await addRepositoryHandler()
        }

        for (const def of selection.definitions) {
            moveDefinition(def, repository)
        }

    } else {
        for (const defName of selection.definitions) {

            printDependencies(defName)

            try {
                const selection = await prompt({
                    type: "select",
                    name: "repository",
                    message: 'Where do you want to move this Definition?',
                    choices: repositoryChoicesAdd
                });

                let repository = selection.repository
                if (selection.repository == "[New Repository]") {
                    repository = await addRepositoryHandler()
                }

                moveDefinition(defName, repository)
            } catch (error) {
                break;
            }
        }

    }

    console.log("")
}

async function checkDependency(repo, verbose) {

    let repoCur
    let depRep = new Set([])

    for (const definition of definitions[repo].dependencies) {

        let dependencies = findDependencies(definition);

        for (const dependency of dependencies) {

            for (const repository in repositories) {
                if (repositories[repository].definitions.includes(dependency)) {
                    repoCur = repository
                }
            }

            if (repositories[repo].dependencies.includes(repoCur)) {
                if (verbose) console.log("Repository " + repo + " is dependant on " + repoCur + ": " + definition + " [" + repo + "] -> " + dependency + " [" + repoCur + "]")
                depRep.add(repoCur)
            }
        }
    }

    console.log("--------------------------------------------------")
    console.log(repo + " is dependant on repositories: ")
    for (let dep of depRep) console.log(dep);

}


async function checkIfViable(auto) {

    for (const repo in repositories) {
        if (Object.hasOwnProperty.call(repositories, repo)) {

            for (const definition of repositories[repo].definitions) {

                let dependencies = findDependencies(definition);

                for (const dependency of dependencies) {

                    for (const repository in repositories) {
                        if (repositories[repository].definitions.includes(dependency)) {
                            repoCur = repository
                        }
                    }

                    if (!(repositories[repo].dependencies.includes(repoCur)) && repo != repoCur) {

                        if (auto) {

                            repositories[repo].dependencies.push(repoCur)
                            console.log(`Repository [${repo}] is now dependent on repository [${repoCur}]`)
                            getRepositoryChoices()

                        } else {

                            console.log("Dependency of " + definition + " [" + repo + "]: " + dependency + " is in another Repository [" + repoCur + "], that this repository has no dependancy to")

                            try {

                                const input = await prompt({
                                    type: "select",
                                    name: "selection",
                                    message: "What do you want to do?",
                                    choices: [{
                                            name: "moveDependency",
                                            message: "Move dependency of this definition",
                                            value: 1
                                        },
                                        {
                                            name: "addDependency",
                                            message: "Add dependency to this repository",
                                            value: 2
                                        },
                                        {
                                            name: "moveDefinition",
                                            message: "Move Definition",
                                            value: 3
                                        }
                                    ]
                                });

                                switch (input.selection) {
                                    case "moveDependency":
                                        try {
                                            const input = await prompt({
                                                type: "select",
                                                name: "repository",
                                                message: "Move the dependency to another Repository?",
                                                choices: repositoryChoicesAdd
                                            });

                                            let repository = input.repository
                                            if (input.repository == "[New Repository]") {
                                                repository = await addRepositoryHandler()
                                            }

                                            moveDefinition(dependency, repository)
                                        } catch (error) {
                                            console.log("Dependency was not moved")
                                        }
                                        break;
                                    case "addDependency":
                                        try {
                                            repositories[repo].dependencies.push(repoCur)
                                            console.log(`Repository [${repo}] is now dependent on repository [${repoCur}]`)
                                            getRepositoryChoices()
                                        } catch (error) {
                                            console.log("No Dependency was added")
                                        }
                                        break;
                                    case "moveDefinition":
                                        try {
                                            let selection = await prompt([{
                                                type: "select",
                                                name: "repository",
                                                message: 'Where do you want to move this Definition?',
                                                choices: repositoryChoicesAdd
                                            }]);

                                            let repository = selection.repository
                                            if (selection.repository == "[New Repository]") {
                                                repository = await addRepositoryHandler()
                                            }

                                            moveDefinition(selection.definition, repository)
                                        } catch (error) {
                                            console.log("No Dependency was added")
                                        }
                                        break;
                                    default:
                                        break;
                                }
                            } catch (error) {
                                console.log(chalk.yellow("Definition was not moved"))
                            }
                        }
                    } else if (repositories[repo].dependencies.includes(repoCur)) {
                        //console.log("Repository " + repo + " is dependant on " + repoCur + ": " + definition + " [" + repo + "] -> " + dependency + " [" + repoCur + "]")
                    }
                }

            }
        }
    }
}

function addRepository(name, namespace) {
    repositories[name] = {
        definitions: [],
        dependencies: [],
        namespace: namespace
    }

    getRepositoryChoices()

    console.log("Repository \"" + name + "\" added succesfully")
}

function removeRepository(name) {
    if (repositories[name].definitions.length === 0) {
        delete repositories[name]

        getRepositoryChoices()
        console.log("Repository \"" + name + "\" was removed succesfully")
    } else {
        console.log("Repository \"" + name + "\" is not empty. Move all definitions to another repository first.")
    }
}

function listDefinitions(repository) {

    for (const definition of repositories[repository].definitions.sort()) {
        console.log(chalk.bold(definition) + " [" + chalk.magenta.bgWhite(definitions[definition].type) + "]" + " [" + chalk.magenta.bgWhite(definitions[definition].namespace) + "]")
    }

}

function findDefinitions(term) {

    let results = []

    for (const definition in definitions) {
        if (definition.toLowerCase().includes(term.toLowerCase())) {

            results.push(definition)

        }
    }

    return results

}

function printDefinitions(defs) {

    for (const definition of defs) {

        let repo

        for (const repository in repositories) {
            if (repositories[repository].definitions.includes(definition)) {
                repo = repository
            }
        }

        console.log(definition + " [" + chalk.magenta(definitions[definition].type) + "]" + " [" + repo + "]")

    }
}

function complete(commands) {
    return function (str) {
        var i;
        var ret = [];
        for (i = 0; i < commands.length; i++) {
            if (commands[i].indexOf(str) == 0)
                ret.push(commands[i]);
        }
        return ret;
    };
};

async function writeCopybaraConfig() {

    let copybaraConfig = `urlOrigin = "https://github.com/OpenTOSCA/tosca-definitions-internal.git"`

    for (const repo in repositories) {
        copybaraConfig += `\n
core.workflow(
    name = "${repo}",
    origin = git.origin(
        url = urlOrigin,
        ref = "master",
    ),
    destination = git.destination(
        url = "${config.destPath + "/" + repo}",
        fetch = "master",
        push = "master",
    ),
    authoring = authoring.pass_thru("OpenTOSCA Bot <opentosca@iaas.uni-stuttgart.de>"),
    origin_files = glob("[`

        const regex = /\\/g;

        for (const definition of repositories[repo].definitions) {
            if (definitions[definition].directory) {
                let path = definitions[definition].directory.replace(config.path, "").replace(regex, "/")
                copybaraConfig += "\n\t\t\"" + path + "\","
            }
        }


        copybaraConfig += `]),
    destination_files = glob(["**"], exclude = ["README_INTERNAL.md"]),
    mode = "ITERATIVE",
)\n`
    }



    saveData(copybaraConfig, "copy.bara.sky")
}

async function addRepositoryHandler() {
    let repo
    try {
        repo = await prompt([{
            type: "input",
            name: "name",
            message: 'Enter the name of the new repository'
        }, {
            type: "input",
            name: "namespace",
            message: 'Enter the namespace of the new repository'
        }])

        addRepository(repo.name, repo.namespace)
    } catch (error) {
        console.log("No Repository was added")
    }

    return repo.name
}

function getServiceTemplates() {
    let serviceTemplates = []

    for (const definition of repositories.unsorted.definitions) {

        if (definitions[definition].type == "ServiceTemplate") {

            serviceTemplates.push(definition)

        }
    }

    return serviceTemplates
}

async function autoSortDefinitions(type) {

    switch (type) {
        case "Best":

            if (!repositories["Normative"]) {
                addRepository("Normative", "http://docs.oasis-open.org/tosca/ns/2011/12/ToscaBaseTypes")
            }

            if (!repositories["oftenUsed"]) {
                addRepository("oftenUsed", "http://opentosca.org/oftenUsed")
            }

            for (const definition in definitions) {
                if (definitions[definition].namespace === "http://docs.oasis-open.org/tosca/ns/2011/12/ToscaBaseTypes") {
                    moveDefinition(definition, "Normative")
                }
            }

            while (true) {
                try {
                    let serviceTemplates = getServiceTemplates()
                    if (serviceTemplates.length > 0) {
                        await sortRepositories(serviceTemplates);
                        serviceTemplates = getServiceTemplates()
                        getRepositoryChoices()
                    } else {
                        break;
                    }
                } catch (error) {
                    console.log("Aufteilung der ServiceTemplates beendet")
                    break;
                }
            }

            const copyOfUnsorted = [...repositories.unsorted.definitions];

            for (const definition of copyOfUnsorted) {

                let repositoriesWithDependency = []

                for (const def in definitions) {
                    if (definitions[def].type === "ServiceTemplate") {
                        const dependencies = findDependencies(def, new Set(), true);
                        if (dependencies.has(definition)) {

                            for (const repository in repositories) {
                                if (repositories[repository].definitions.includes(def)) {

                                    if (!repositoriesWithDependency.includes(repository)) {
                                        repositoriesWithDependency.push(repository)
                                    }
                                }
                            }

                        }
                    }
                }

                if (repositoriesWithDependency.length > 1) {

                    moveDefinition(definition, "oftenUsed")

                    //const dependencies = findDependencies(definition)

                } else if (repositoriesWithDependency.length == 1) {
                    moveDefinition(definition, repositoriesWithDependency[0])

                    //const dependencies = findDependencies(definition)
                }

                //}


            }
            break;
        case "Namespace":

            for (const definition in definitions) {

                if (!repositories[definitions[definition].namespace]) {
                    addRepository(definitions[definition].namespace, definitions[definition].namespace)
                }

                moveDefinition(definition, definitions[definition].namespace)

                //repositories[repo].dependencies.push(repoCur)
            }

            break;
        case "Type":

            break;
        default:
            break;
    }

    checkIfViable(true)

}

async function main() {

    readAllData()

    console.log(chalk.bold.bgBlue.black("TOSCA Namespace Sort v0.0.1 - Type \"help\" for information on usage"))

    while (true) {

        let input = ""

        try {
            input = await prompt({
                type: "input",
                name: "command",
                message: ">",
                history: {
                    store: new Store({
                        path: `${__dirname}/history.json`
                    }),
                    autosave: true
                }
            })
        } catch (error) {

            try {
                let input = await prompt({
                    type: "confirm",
                    name: "exit",
                    message: 'Are you sure you want to exit?'
                })

                if (input.exit) {
                    process.exit(0)
                } else {
                    continue
                }
            } catch (error) {
                process.exit(0)
            }

        }

        input = input.command.split(/\b\s+/)

        switch (input[0]) {
            case "help":
                console.log("'list', 'find', 'addRepo', 'save', 'check', 'analyze', 'dependencies', 'sort', 'move'")
                break;
            case "list":
                if (!input[1]) {

                    try {
                        input = await prompt({
                            type: "select",
                            name: "repository",
                            message: 'Which repository do you want to list?',
                            choices: repositoryChoices
                        })

                        listDefinitions(input.repository)
                    } catch {

                    }

                } else if (input[1] == "top") {
                    console.log(Object.entries(counter).sort((a, b) => b[1] - a[1]));
                }
                break;
            case "find":
                let searchTerm = ""

                if (!input[1]) {

                    let search = await prompt({
                        type: "input",
                        name: "term",
                        message: 'Enter a search term:'
                    })

                    searchTerm = search.term

                } else {
                    searchTerm = input[1]
                }

                printDefinitions(findDefinitions(searchTerm))
                break;
            case "addRepo":
                await addRepositoryHandler()
                break;
            case "removeRepo":
                try {

                    let input = await prompt({
                        type: "select",
                        name: "repository",
                        message: 'Which repository do you want to remove?',
                        choices: repositoryChoices
                    })

                    removeRepository(input.repository)
                } catch (error) {
                    console.log("No Repository was removed")
                }
                break;
            case "save":
                saveAllData()
                console.log("All data was saved successfully.")
                break;
            case "check":
                await checkIfViable()
                console.log("Checked successfully.")
                break;
            case "analyze":
                await analyzeRepo()
                break;
            case "addDependency":
                try {
                    let input = await prompt([{
                        type: "select",
                        name: "repository",
                        message: 'To which repository do you want to add a Dependancy?',
                        choices: repositoryChoices
                    }, {
                        type: "select",
                        name: "dependency",
                        message: 'Which repository do you want the selected repository to be dependant on?',
                        choices: repositoryChoices
                    }])

                    repositories[input.repository].dependencies.push(input.dependency)
                    console.log(`Repository [${input.repository}] is now dependent on repository [${input.dependency}]`)
                    getRepositoryChoices()
                } catch (error) {
                    console.log("No Dependency was added")
                }

                break;
            case "dependencies":
                if (!input[1]) {
                    let defs = []
                    for (const repo in repositories) {
                        defs = defs.concat(repositories[repo].definitions)
                    }

                    const selection = await prompt([{
                        type: "autocomplete",
                        name: "definition",
                        message: 'Choose a Definition:',
                        limit: 10,
                        initial: 0,
                        choices: defs
                    }]);

                    printDependencies(selection.definition)
                } else {
                    let dependencies = findDependencies(input[1]);
                    console.log(dependencies)
                }
                break;
            case "sort":
                await sortRepositories()
                break;
            case "move":
                if (!input[1]) {
                    let defs = []

                    for (const repo in repositories) {
                        defs = defs.concat(repositories[repo].definitions)
                    }

                    const selection = await prompt([{
                        type: "autocomplete",
                        name: "definition",
                        message: 'Enter a Definition you want to move:',
                        limit: 10,
                        initial: 0,
                        choices: defs
                    }, {
                        type: "select",
                        name: "repository",
                        message: 'Where do you want to move this Definition?',
                        choices: repositoryChoicesAdd
                    }]);

                    let repository = selection.repository
                    if (selection.repository == "[New Repository]") {
                        repository = await addRepositoryHandler()
                    }

                    moveDefinition(selection.definition, repository)

                } else if (input[1] === "find") {
                    if (input[2]) {
                        let foundDefinitions = findDefinitions(input[2])

                        await sortRepositories(foundDefinitions)
                    }
                } else if (input[1] === "repo") {
                    try {

                        const repo = await prompt([{
                            type: "select",
                            name: "origin",
                            message: 'Contents of which repository do you want to move?',
                            choices: repositoryChoices
                        }, {
                            type: "select",
                            name: "destination",
                            message: 'In which repository do you want to move the definitions?',
                            choices: repositoryChoicesAdd
                        }]);

                        let repository = repo.destination
                        if (repo.destination == "[New Repository]") {
                            repository = await addRepositoryHandler()
                        }

                        for (var i = repositories[repo.origin].definitions.length - 1; i >= 0; i--) {
                            console.log(repositories[repo.origin].definitions[i])
                            moveDefinition(repositories[repo.origin].definitions[i], repository)
                        }

                        console.log(`All definitions moved succesfully from ${repo.origin} to ${repository}`)
                    } catch (error) {
                        console.log(`No definitions were moved`)
                    }
                }

                console.log("")
                console.log(chalk.blue("Checking whether all Dependencies are only dependant on a higher repository."))
                await checkIfViable()

                break;
            case "checkDep":
                if (!input[1]) {
                    console.log("To find dependencies, enter the name of a definition.")
                } else {
                    let v = false
                    if (input[2] == "printAll") {
                        v = true;
                    }
                    await checkDependency(input[1], v)
                }
                break;
            case "autosort":
                try {
                    let input = await prompt({
                        type: "select",
                        name: "sort",
                        message: 'How do you want to sort the definitions?',
                        choices: ["Namespace", "Type", "Best"]
                    })

                    await autoSortDefinitions(input.sort)
                } catch (error) {
                    console.log("Definitions were not sorted")
                    console.log(error)
                }
                break;
            case "copybara":
                await writeCopybaraConfig();
                break;
            default:
                break;
        }
    }
}

main();