// ==UserScript==
// @name       BaiduPanFileList
// @namespace  https://greasyfork.org/scripts/5128-baidupanfilelist/code/BaiduPanFileList.user.js
// @version    1.2.2
// @description  统计百度盘文件(夹)数量大小. Thanks BaiduPanMD5Button
// @match	https://pan.baidu.com/disk/home*
// @include	https://pan.baidu.com/disk/home*
// @require http://libs.baidu.com/jquery/2.1.1/jquery.min.js
// @grant GM_xmlhttpRequest
// @grant GM_setClipboard
// @run-at document-end
// @copyright  2014+, icgeass@hotmail.com
// ==/UserScript==

// %Path% = 文件路径
// %FileName% = 文件名
// %Tab% = Tab键
// %FileSize% = 可读文件大小（带单位保留两位小数，如：6.18 MiB）
// %FileSizeInBytes% = 文件大小字节数（为一个非负整数）

var _BaiduPanFileList_Pattern = "%Path%%Tab%%FileSize%(%FileSizeInBytes% Bytes)";


var url = document.URL;
var BTN_WAITING_TEXT = "統計檔案";
var BTN_RUNNING_TEXT = "處理中...";
var BASE_URL_API = "https://pan.baidu.com/api/list?channel=chunlei&clienttype=0&web=1&dir=";

// 按钮
var btn_curr = document.createElement("button");
btn_curr.type = "button";
btn_curr.style.cssText = 'margin: 0px 10px;height: 28px;';
btn_curr.innerHTML = BTN_WAITING_TEXT;
btn_curr.id = BTN_WAITING_TEXT;
btn_curr.disabled = false;
btn_curr.waiting_text = BTN_WAITING_TEXT;
btn_curr.running_text = BTN_RUNNING_TEXT;
btn_curr.error = false;
// 按钮单击
btn_curr.onclick = function(e){
    e = e||window.event;
    if(e.ctrlKey){
       showInfo(btn_curr, true);
    }else{
       showInfo(btn_curr, false);
    }
};

// 键盘, 确保在按钮添加失败时依旧可用
document.addEventListener("keydown", function(e){
    e = e||window.event;
    var key = e.keyCode||e.charCode;
    if(key == 81||key == 113){
        if(e.ctrlKey){
            showInfo(btn_curr, true);
        }else{
            showInfo(btn_curr, false);
        }
    }
}, false);

// 自己的网盘添加按钮
if (url.indexOf("http://pan.baidu.com/disk/home") != -1) {
    if(!document.getElementById(BTN_WAITING_TEXT)){
        $("[style='position: absolute; top: 0px; padding-top: 11px; line-height: normal;']").append(btn_curr);
    }
}

// 处理按钮和快捷键
function showInfo(button, includeSubDir) {
    if(button.disabled||button.error){
        return;
    }
    showBtn(false);
    url = document.URL;
    while (url.indexOf("%25") != -1) {
        url = url.replace("%25", "%");
    }
    var listurl = BASE_URL_API; 
    var folder_access_times = 0;
    var currentDir = "";
    var checkedPath = new Array();
    
    var str_alert = "";
    var num_all_files = 0;
    var num_all_folder = 0;
    var num_jpg = 0;
    var num_original = 0;
    var name_all = new Array();
    var size_all = 0;
    // 百度api
    // http://pan.baidu.com/api/list?channel=chunlei&clienttype=0&web=1&num=100&page=1&dir=<PATH>&order=time&desc=1&showempty=0&_=1404279060517&bdstoken=9c11ad34c365fb633fc249d71982968f&app_id=250528
    // 测试url
    // http://pan.baidu.com/disk/home#dir/path=<PATH>
    // http://pan.baidu.com/disk/home#from=share_pan_logo&path=<PATH>
    // http://pan.baidu.com/disk/home#key=<KEY>
    // http://pan.baidu.com/disk/home#path=<PATH>
    // http://pan.baidu.com/disk/home
    // http://pan.baidu.com/disk/home#path=<PATH>&key=<KEY>
    if (url.indexOf("path=") == -1) {
        listurl += "%2F";
        currentDir = "/";
        getList(listurl);
    } else if(url.indexOf("path=") != -1){
        var path = url.substring(url.indexOf("path=") + 5);
        if(path.indexOf("&") != -1){
            path = path.substring(0, path.indexOf("&"));
        }
        listurl += path;
        currentDir = decodeURIComponent(path);
        getList(listurl);
    }
    // 保存选择文件（夹）路径
    checkedPath = getCheckedPathArray(currentDir);
    // 请求数据
    function getList(url) {
        if(button.error){
            return;
        }
        GM_xmlhttpRequest({
            method : 'GET',
            synchronous : false,
            url : url,
            timeout : 9999,
            onabort : function() {
                showError(decodeURIComponent(url.replace(BASE_URL_API, "")) + "\n\n意外终止, 请刷新重试");
            },
            onerror : function() {
                showError(decodeURIComponent(url.replace(BASE_URL_API, "")) + "\n\n未知错误, 请刷新重试");
            },
            ontimeout : function() {
                showError(decodeURIComponent(url.replace(BASE_URL_API, "")) + "\n\n请求超时, 请刷新重试");
            },
            onload : function(reText) {
                var JSONobj = JSON.parse(reText.responseText);
                if (JSONobj.errno != 0) {
                    showError("读取目录: " + decodeURIComponent(url.replace(BASE_URL_API, "")) + "  失败, 错误码: " + JSONobj.errno);
                    return;
                }
                var size_list = JSONobj.list.length;
                var curr_item = null;
                for ( var i = 0; i < size_list; i++) {
                    curr_item = JSONobj.list[i];
                    if(listurl === url && checkedPath.length != 0 && !isArrayContains(checkedPath, curr_item.path)){
                    	continue;
                    }
                    if (curr_item.isdir == 1) {
                        num_all_folder++;
                        name_all.push(curr_item.path);
                        if (includeSubDir) {
                            folder_access_times++;
                            getList(BASE_URL_API + encodeURIComponent(curr_item.path));
                        }
                    } else {
                        num_all_files++;
                        if (curr_item.server_filename.indexOf(" (JPG).zip") != -1) {
                            num_jpg++;
                        } else if (curr_item.server_filename.indexOf(".zip") != -1) {
                            num_original++;
                        }
                        size_all += curr_item.size;
						if(typeof _BaiduPanFileList_Pattern == "string"){
                            name_all.push(_BaiduPanFileList_Pattern.replace("%FileName%", curr_item.server_filename).replace("%Path%", curr_item.path).replace("%FileSizeInBytes%", curr_item.size).replace("%Tab%", "\t").replace("%FileSize%", getReadableFileSizeString(curr_item.size)));
                        }else{
                            name_all.push(curr_item.path + "\t" + getReadableFileSizeString(curr_item.size) + "(" + curr_item.size + " Bytes)");
                        }
                    }
                }
                folder_access_times--;
                if (folder_access_times + 1 == 0) {
                    var CTL = "\r\n";
                    str_alert = (checkedPath.length == 0 ? currentDir : checkedPath.join("\r\n")) + CTL + CTL
                    + "files: " + num_all_files + ", folders: " + num_all_folder + CTL
                    + "xxx (JPG).zip: " + num_jpg + CTL
                    + "xxx.zip: " + num_original + CTL 
                    + "size: " + getReadableFileSizeString(size_all) + "  ("+ size_all.toLocaleString() + " Bytes)" + CTL;
                    GM_setClipboard(str_alert + CTL + CTL + name_all.sort().join("\r\n") + "\r\n");
                    alert(str_alert.replace(/\r\n/g, "\n"));
                    showBtn(true);
                }
            }
        });
    }
    // 错误提示
    function showError(info){
        if(!button.error){
            button.error = true;
            alert(info);
        }
    }
    // 禁用启用按钮
    function showBtn(isDisplay) {
        if (isDisplay === true) {
            button.innerHTML = button.waiting_text;
            button.disabled = false;
        } else {
            button.disabled = true;
            button.innerHTML = button.running_text;
        }
    }
}

// 转换可读文件大小
function getReadableFileSizeString(fileSizeInBytes) {
    var i = 0;
    var byteUnits = [ ' Bytes', ' KiB', ' MiB', ' GiB', ' TiB', ' PiB', ' EiB',
                     ' ZiB', ' YiB' ];
    while (fileSizeInBytes >= 1024) {
        fileSizeInBytes = fileSizeInBytes / 1024;
        i++;
    }
    return fileSizeInBytes.toFixed(2) + byteUnits[i];
}

// 得到选择项目，如果获取失败则返回空数组
function getCheckedPathArray(currentDir){
	var re = new Array();
	var items;
	try {
		items = getCheckItems();
		for (var i = 0; i < items.length; i++) {
            if(items[i].server_filename == "我的应用数据"){
                re.push("/apps");
            }else{
                re.push((currentDir == "/" ? currentDir : currentDir + "/") + items[i].server_filename);
            }
		}
	} catch (e) {
		// TODO: handle exception
	}
	return re;
}

// 判断是数组中是否还有指定元素
function isArrayContains(arr, obj) {
    var i = arr.length;
    while (i--) {
       if (arr[i] === obj) {
           return true;
       }
    }
    return false;
}



// //////////////////////////////////////////////////////////////////////

/*
 * === 说明 === 
 * @作者:有一份田 
 * @官网:http://www.duoluohua.com/download/
 * @Email:youyifentian@gmail.com 
 * @Git:http://git.oschina.net/youyifentian
 * @转载重用请保留此信息
 * 
 * 
 * modified by icgeass@hotmail.com
 */
function getCheckItems(){
    var items=[];
    var containerStyle = $('.list-view-container').attr("style");
    var boxCss=(_isEmpty(containerStyle) || containerStyle == 'display: block;') ? 'module-list-view' : 'module-grid-view';
    $('div.' + boxCss).find('.item-active').each(function(i,o){
    	var server_filename = $(o).find(".filename").attr('title');
    	if(!_isEmpty(server_filename)){
    		items.push({'server_filename':server_filename});
    	}
    });
    return items;
}
function _isEmpty(e){
    return e == undefined || e == null || e == '';
}
/*function getCheckItems(){
    var items=[],boxCss=$('.list-selected').length ? 'module-list-view' : 'module-grid-view';
    $('div.' + boxCss).find('.item-active').each(function(i,o){
        items.push(getListViewCheckedItemInfo(o));
    });
    return items;
}
function getListViewCheckedItemInfo(obj){
    var o=$(obj),fs_id=o.attr('data-id'),category=o.attr('data-category'),
        isdir=o.attr('data-extname')=='dir' ? 1 : 0,
        server_filename=o.find('[node-type="name"]').attr('title'),
        dlink=o.attr('dlink') || '';
    return {'fs_id':fs_id,'category':category,'isdir':isdir,'server_filename':server_filename,'dlink':dlink,'item':obj};
}*/
