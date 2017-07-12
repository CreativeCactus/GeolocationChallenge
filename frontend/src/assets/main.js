const latlonApp = angular.module('latlonApp', []);
latlonApp.filter('secureHtml', $sce => input => $sce.trustAsHtml(input));
latlonApp.controller('ngCtrl', ($scope) => {
    let json;

    const submit = document.querySelector('#UploadSubmit');
    const select = document.querySelector('#UploadSelect');

    const interpretType = {
        'text/csv': CSVtoJSON,
        'text/json': data => JSON.stringify(JSON.parse(data))
    };
    const allowedTypes = Object.keys(interpretType);
    const UploadStatusEnum = {
        NoFile: 'No file selected',
        BadType: 'Unexpected file type: ',
        TooBig: 'File size exceeded: Max 1MB, got',
        TooOld: 'WARNING: Your browser may be outdated or lack file API support',
        Ready: 'File ready: ',
        Done: 'Upload finished: ',
        RemoteErr: 'Remote error: '
    };

    const EntriesList = [];

    $scope.stats = 'Loading...';
    $scope.EntriesList = '';
    $scope.UploadStatus = UploadStatusEnum.NoFile;
    $scope.EntriesList = () => {
        if (EntriesList.length == 0) return 'Make a request below to begin...';
        console.dir(EntriesList);
        return EntriesList.map(v => `<div class="entryItem"><a href="/api/${v.id}">${v.id} [${v.status}:${v.message}] (${v.percent || 0}%)</p></div>`).join('<br>');
    };
    

    /*
    .d8888. d88888b db      d88888b  .o88b. d888888b 
    88'  YP 88'     88      88'     d8P  Y8 `~~88~~' 
    `8bo.   88ooooo 88      88ooooo 8P         88    
      `Y8b. 88~~~~~ 88      88~~~~~ 8b         88    
    db   8D 88.     88booo. 88.     Y8b  d8    88    
    `8888Y' Y88888P Y88888P Y88888P  `Y88P'    YP 
    */

    const selecting = function () {
        submit.disabled = true;
        json = null;

        // Ensure a file is selected
        if (select.files.length === 0) {
            $scope.UploadStatus = UploadStatusEnum.NoFile;
            $scope.$apply();
            return;
        }

        const file = select.files[0];

        // Limit filetpyes allowed
        if (allowedTypes.indexOf(file.type) < 0) {
            $scope.UploadStatus = UploadStatusEnum.BadType + file.type;
            $scope.$apply();
            return;
        }

        // Limit filesize to 1MB
        if (file.size > (1 << 20)) {
            $scope.UploadStatus = `${UploadStatusEnum.TooBig + ~~(file.size / 1024)}KB`;
            $scope.$apply();
            return;
        }

        const reader = new FileReader();

        reader.onload = (e) => {
            json = interpretType[file.type](e.target.result);
            submit.disabled = false;

            $scope.UploadStatus = `${UploadStatusEnum.Ready} ${file.size} bytes.`;
            $scope.$apply();
        };

        reader.readAsBinaryString(file);
    };

    /*
    db    db d8888b. db       .d88b.   .d8b.  d8888b. 
    88    88 88  `8D 88      .8P  Y8. d8' `8b 88  `8D 
    88    88 88oodD' 88      88    88 88ooo88 88   88 
    88    88 88~~~   88      88    88 88~~~88 88   88 
    88b  d88 88      88booo. `8b  d8' 88   88 88  .8D 
    ~Y8888P' 88      Y88888P  `Y88P'  YP   YP Y8888D' 
    */

    const upload = function () {
        if (!json) {
            $scope.UploadStatus = UploadStatusEnum.NoFile;
            $scope.$apply();
            return;
        }

        // Perform a POST
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/', true);
        xhr.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');

        // Handle the response
        xhr.onloadend = function () {
            // Check that the response is JSON
            let response = xhr.responseText;
            try {
                response = JSON.parse(response);
                if (response.status === 1) {
                    EntriesList.push(response.request);
                    response = `Got ID:\n${response.request.id}`;
                }
            } catch (e) {}
            $scope.UploadStatus = UploadStatusEnum.Done + response;
            $scope.$apply();
        };
        xhr.send(json);
        json = null;
    };

    /*
    db      d888888b .d8888. d888888b 
    88        `88'   88'  YP `~~88~~' 
    88         88    `8bo.      88    
    88         88      `Y8b.    88    
    88booo.   .88.   db   8D    88    
    Y88888P Y888888P `8888Y'    YP  
    */

    // Take an ID and return the result of a GET/api:id
    const entryUpdate = (id) => {
        const updater = new Promise((a, r) => {
            // Perform a GET
            const xhr = new XMLHttpRequest();
            xhr.open('GET', `/api/${id}`, true);
            xhr.onload = function (e) {
                if (xhr.readyState === 4) {
                    if (xhr.status !== 200) {
                        const error = UploadStatusEnum.RemoteErr + xhr.responseText;
                        $scope.UploadStatus = error;
                        $scope.$apply();
                        return r(error);
                    }
                    const result = JSON.parse(xhr.responseText);
                    a(result);
                }
            };
            xhr.addEventListener('error', (e) => {
                console.error(xhr.statusText);
            });
            xhr.send();
        });
        // Return promise ready to be called
        return updater;
    };

    // Update the entry list and merge results
    const listUpdate = function () {
        EntriesList.forEach((e, i) => {
            if (e.error) return;

            entryUpdate(e.id)
                .then((entry) => { EntriesList[i] = merge(EntriesList[i], entry); })
                .then($scope.$apply)
                .catch((err) => { EntriesList[i].error = err; });
        });
    };

    // Initialisation
    submit.addEventListener('click', upload);
    select.addEventListener('change', selecting);
    setInterval(listUpdate, 10 * 1000); // check updates every 10 sec

    // Check for File API support.
    const FullFileAPISupport = window.File && window.FileReader && window.FileList && window.Blob;
    if (!FullFileAPISupport) {
        $scope.UploadStatus = UploadStatusEnum.TooOld;
    }
});

/*
db    db d888888b d888888b db      .d8888. 
88    88 `~~88~~'   `88'   88      88'  YP 
88    88    88       88    88      `8bo.   
88    88    88       88    88        `Y8b. 
88b  d88    88      .88.   88booo. db   8D 
~Y8888P'    YP    Y888888P Y88888P `8888Y'
*/

function CSVtoJSON(csv, headerLinePresent = false) {
    // Define beastly regex for matching commas outside of top level quotes.
    const rxCommasOutsideQuotes = /,(?=([^`'"]*[`'"][^`'"]*[`'"])*[^`'"]*$)/g;
    // Helper to remove matched elements from the resulting array, but keep empty strings.
    const splitOnLoneCommas = str => str
            .split(rxCommasOutsideQuotes)
            .filter(noEmpty => noEmpty !== undefined);

    // Set up header
    const lines = csv.split(/[\n\r]+/g);
    const headerLine = (headerLinePresent ? lines.shift() : 'name,address');
    const header = splitOnLoneCommas(headerLine.toLowerCase());

    // Map each line to an object
    const results = lines.map(line => 
        splitOnLoneCommas(line)
            // Remove any matching quotes from either side of the data
            .map((val) => {
                const rx = /^(["'`]+)([\W\w]*)(\1)$/g;
                const result = rx.exec(val);
                val = (result ? result[2] : val).trim();
                return val;
            })
            // Reduce to an object
            .reduce((obj, value, index) => {
                const key = header[index];
                if (key) obj[key] = value;
                return obj;
            }, {})
    );

    // Return resultant array
    return JSON.stringify(results);
}

function merge(target, source) {
    Object.keys(source).forEach((key) => {
        if (source[key] instanceof Object) Object.assign(source[key], merge(target[key], source[key]));
    });

    // Join `target` and modified `source`
    Object.assign(target || {}, source);
    return target;
}
