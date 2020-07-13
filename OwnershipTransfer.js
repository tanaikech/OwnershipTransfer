/**
 * GitHub  https://github.com/tanaikech/OwnershipTransfer<br>
 * Transfer the owner of a folder.<br>
 * @param {object} Object object
 * @return {object} Returned values.
 */
function setFolder(object) {
    return new OwnershipTransfer(object).SetFolder();
}

/**
 * Transfer the owner of files.<br>
 * @param {object} Object object
 * @return {object} Returned values.
 */
function setFiles(object) {
    return new OwnershipTransfer(object).SetFiles();
}
;
(function(r) {
  var OwnershipTransfer;
  OwnershipTransfer = (function() {
    var deletePermission, main, paramsChecker, retrievePermissionIDs, transferOwnerOfFiles;

    class OwnershipTransfer {
      constructor(obj_) {
        if (!obj_) {
          throw new Error("Please give an object for using this library.");
        }
        if (!paramsChecker.call(this, obj_)) {
          throw new Error("Parameters in object is not correct. Please check again.");
        }
        this.start = new Date();
        this.obj = {
          input: obj_,
          done: [],
          err: []
        };
        this.start_P_time1 = 0;
      }

      // --- methods --- begin
      SetFolder() {
        var files, fromOwnerMail, temp, toOwnerMail;
        this.start_P_time1 = this.start.getTime();
        if (DriveApp.getFileById(this.obj.input.folderId).getMimeType() === !MimeType.FOLDER) {
          throw new Error("Inputted ID is not the folder ID.");
        }
        files = FilesApp.getAllInFolder(this.obj.input.folderId, null, "files(id)");
        fromOwnerMail = this.obj.input.fromOwnerMail;
        toOwnerMail = this.obj.input.toOwnerMail;
        temp = {
          fileId: this.obj.input.folderId,
          fromOwnerMail: fromOwnerMail,
          toOwnerMail: toOwnerMail,
          transferFlag: 0
        };
        this.obj.input = files.map((f) => {
          return {
            fileId: f.id,
            fromOwnerMail: fromOwnerMail,
            toOwnerMail: toOwnerMail,
            transferFlag: 1
          };
        });
        this.obj.input.unshift(temp);
        return main.call(this);
      }

      SetFiles() {
        this.start_P_time1 = this.start.getTime();
        this.obj.input = this.obj.input.filter((e) => {
          return DriveApp.getFileById(e.fileId).getMimeType() !== MimeType.FOLDER;
        });
        this.obj.input.forEach((e) => {
          return e.transferFlag = 0;
        });
        return main.call(this);
      }

    };

    OwnershipTransfer.name = "OwnershipTransfer";

    // --- methods --- end
    paramsChecker = function(obj_) {
      var check;
      if (!Array.isArray(obj_) && !obj_.hasOwnProperty("folderId")) {
        return false;
      }
      if (Array.isArray(obj_)) {
        check = obj_.reduce((ar, {fileId, fromOwnerMail, toOwnerMail}) => {
          if (!fileId || !fromOwnerMail || !toOwnerMail) {
            ar.push("error");
          }
          return ar;
        }, []);
        return check.length === 0;
      }
      return obj_.hasOwnProperty("folderId");
    };

    main = function() {
      var end_P_time1;
      retrievePermissionIDs.call(this);
      transferOwnerOfFiles.call(this);
      deletePermission.call(this);
      end_P_time1 = Date.now();
      return {
        finished: this.obj.done,
        errors: this.obj.err,
        startTime: this.start,
        processTime: (end_P_time1 - this.start_P_time1) / 1000
      };
    };

    retrievePermissionIDs = function() {
      var e, requests, res;
      try {
        requests = this.obj.input.map(({fileId}) => {
          return {
            method: "GET",
            endpoint: `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?fields=permissions(id,role,emailAddress)`
          };
        });
        res = BatchRequest.EDo({
          batchPath: "batch/drive/v3",
          requests: requests
        });
        res.forEach((e, i) => {
          if (e.hasOwnProperty("permissions") && !e.permissions.some((f) => {
            return f.emailAddress === this.obj.input[i].fromOwnerMail && f.role === "owner";
          })) {
            throw new Error(`File or folder of '${this.obj.input[i].fileId}' that you are not the owner is included. The ownership of such files and folders cannot be transferred.`);
          }
          return this.obj[e.hasOwnProperty("error") ? "err" : "done"].push({
            fileId: this.obj.input[i].fileId,
            response: e,
            emailFrom: this.obj.input[i].fromOwnerMail,
            emailTo: this.obj.input[i].toOwnerMail,
            transferFlag: this.obj.input[i].transferFlag
          });
        });
        return this.obj.permissions = this.obj.done.reduce((ar, {fileId, response, emailFrom, emailTo, transferFlag}, i) => {
          response.permissions.forEach(({id, emailAddress}) => {
            if (emailAddress === emailFrom) {
              return ar.push({
                fileId: fileId,
                permissionId: id,
                emailTo: emailTo,
                transferFlag: transferFlag
              });
            }
          });
          return ar;
        }, []);
      } catch (error) {
        e = error;
        throw new Error(`At retrievePermissionIDs. ${e}`);
      }
    };

    transferOwnerOfFiles = function() {
      var e, ob, requests, res;
      try {
        requests = this.obj.permissions.map(({fileId, emailTo, transferFlag}) => {
          return {
            method: "POST",
            endpoint: `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?transferOwnership=true&enforceSingleParent=true&moveToNewOwnersRoot=${transferFlag === 1 ? false : true}&fields=*`,
            requestBody: {
              role: "owner",
              type: "user",
              emailAddress: emailTo
            }
          };
        });
        res = BatchRequest.EDo({
          batchPath: "batch/drive/v3",
          requests: requests
        });
        ob = res.reduce((o, e, i) => {
          if (e.hasOwnProperty("error")) {
            o.err.push({
              fileId: this.obj.permissions[i].fileId,
              response: e
            });
          } else {
            o.done.push({
              fileId: this.obj.permissions[i].fileId,
              response: e
            });
            o.deletePermissions.push(this.obj.permissions[i]);
          }
          return o;
        }, {
          err: [],
          done: [],
          deletePermissions: []
        });
        this.obj.err = this.obj.err.concat(ob.err);
        this.obj.done = ob.done;
        return this.obj.deletePermissions = ob.deletePermissions;
      } catch (error) {
        e = error;
        throw new Error(`At transferOwnerOfFiles. ${e}`);
      }
    };

    deletePermission = function() {
      var e, ob, requests, res;
      try {
        requests = this.obj.deletePermissions.map(({fileId, permissionId}) => {
          return {
            method: "DELETE",
            endpoint: `https://www.googleapis.com/drive/v3/files/${fileId}/permissions/${permissionId}`
          };
        });
        res = BatchRequest.EDo({
          batchPath: "batch/drive/v3",
          requests: requests
        });
        ob = res.reduce((o, e, i) => {
          o[e.hasOwnProperty("error") ? "err" : "done"].push({
            fileId: this.obj.deletePermissions[i].fileId,
            response: e
          });
          return o;
        }, {
          err: [],
          done: []
        });
        this.obj.err = this.obj.err.concat(ob.err);
        return this.obj.done = ob.done;
      } catch (error) {
        e = error;
        throw new Error(`At deletePermission. ${e}`);
      }
    };

    return OwnershipTransfer;

  }).call(this);
  return r.OwnershipTransfer = OwnershipTransfer;
})(this);
