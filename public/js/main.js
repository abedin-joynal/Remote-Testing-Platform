var CONNECTED_TO_SOCKET = false;
var CUR_CONNECTION_BTN = null;

window.FontAwesomeConfig = {
	searchPseudoElements: true
}

var feed_info;
// feed_info = JSON.parse(feed_info);

var elements_info = $("#elements_info").val();
elements_info = JSON.parse(elements_info);
loadElementsList();

var isLogEnabled = true;
var socket = null;
var connection_port = null;
var connectSignalTimer = null;
var rectSelection = false;
var drawRect = false;
var drawArray=[]
var cvs = null;
var ctx=null;



function loadElementsList(search_term) {
	let sterm = typeof search_term !== 'undefined' ? search_term : "";

	let results = Object.keys(elements_info).filter(item=>new RegExp(sterm, 'i').test(item));
	let filteredElemList = {};
	results.forEach(function(key){
		filteredElemList[key]=elements_info[key];
	});
	let keyList = Object.keys(filteredElemList);

	// console.log(elements_info);
	var row_count = Math.ceil(keyList.length/4);
	// console.log(row_count);
	var dynamic_list = "<div class='row mt-2 elmrow'>";
	var cell_count=0; 
	var current_row_count=0;
	keyList.forEach(function(key){
		let ico_class = '';
		switch (elements_info[key].element_rw) {
			case "Read/Write":
				ico_class = 'fas fa-edit';
				break;
			case "Write":
				ico_class = 'fas fa-pen';
				break;
			default:
				ico_class = 'fas fa-sticky-note';
				break;
		}
		var re = new RegExp(sterm, "ig");
		dynamic_list += "<div class='col-3 text-left'> \
							<button data-id="+elements_info[key].element_id+" class='elem_key btn custom-btn-slimmer btn-outline-secondary'><i class='"+ ico_class +"'></i><br>"+highlight(key, sterm)+"</button> \
						</div>";
						// <button data-key='Child Protection' class='int_key btn custom-btn-slimmer btn-outline-secondary'><i class='fa fa-sticky-note-o'></i><br>"+key+"</button>
		cell_count+=1;
		if (cell_count%4==0){
			dynamic_list+="</div>";
			current_row_count+=1;
			if (current_row_count<row_count){
				dynamic_list += "<div class='row mt-2 elmrow'>";
			}
		}
	});
	$("#elements .elemlist").html(dynamic_list);
}
			
function highlight(text, sterm) {
	var innerHTML = "";
	var index = text.toLowerCase().indexOf(sterm.toLowerCase());
	if (index >= 0) { 
		innerHTML = text.substring(0,index) + "<span class='highlight'>" + text.substring(index,index+sterm.length) + "</span>" + text.substring(index + sterm.length);
	}else{
		console.log('not found');
	}
	return innerHTML;
}

function getActiveSerialPortList(con_id, show_modal){
    $.ajax({
        type: 'json',
        method: 'post',
        url: "/get-serialport",
        data: {},
    }).done(function(res) {
        let divElement = $("#connection-properties-markup").find("#cp-port").next('div.dropdown-menu')
        let divElement2 = $(".tab-pane").filter('.active').find("#cp-port").next('div.dropdown-menu')
        // console.log(divElement2)
        let dynamic_content = '';
        if (res !== "null"){
            res = JSON.parse(JSON.parse(res))
            console.log(res);
            Object.keys(res).forEach(function(item){
                let appendStr = ''
                let addClass = ''
                if(res[item]){
                    appendStr = ' (in use)'
                    addClass = 'disabled'
                }
                dynamic_content += '<a class="dropdown-item '+addClass+'" href="javascript:void(0)">'+item+appendStr+'</a>';
            })
        }
        divElement.html(dynamic_content);
        divElement2.html(dynamic_content);
        $('#connection-modal').modal('show')
        if(show_modal){
            $('.cpm-message').hide();
            if(con_id){
                $(".connection-tab-"+con_id).click()
            }
            else{
                $("#connection-list").find(".list-group-item").first().click()
            }
        }
        // console.log('getactiveserialportlist done');

    });
}

$(document).ready(function() {
    $(".int_key").attr("disabled", "true");
    $(".elem_key").attr("disabled", "true")
    $("input#search_term").attr("disabled", "true")

    cvs = document.getElementById("drawing-canvas");
    cvs.width = $(".canvas-container").width()
    cvs.height = $(".canvas-container").height()
    
    $("#search_term").on("keyup", function(event){
        let sterm = $("#search_term").val();
        loadElementsList(sterm);	
    })

    $(document).on('click', '.int_key', function() {
        let key = $(this).attr('data-key');
        if(socket && socket.connected) {
            let event_data = {"key" : key};
            socket.emit('client_event', event_data);
        }
    })



    var mouse = {
        x: 0,
        y: 0,
        startX: 0,
        startY: 0
    };
    function setMousePosition(e) {
        var ev = e || window.event; //Moz || IE
        if (ev.pageX) { //Moz
            mouse.x = ev.pageX -25;
            mouse.y = ev.pageY -10;
        } else if (ev.clientX) { //IE
            mouse.x = ev.clientX + document.body.scrollLeft;
            mouse.y = ev.clientY + document.body.scrollTop;
        }
    };

    var element = null;

    $(".canvas-container").on('mouseenter', function(){
        $('.sidebar').show("slide", { direction: "left" }, 500);
    }).on("mouseleave", function(){
        $('.sidebar').hide("slide", { direction: "left" }, 500);   
    }).on("mousemove", function(e){
        setMousePosition(e);
        if (element !== null) {
            element.style.width = Math.abs(mouse.x - mouse.startX) + 'px';
            element.style.height = Math.abs(mouse.y - mouse.startY) + 'px';
            element.style.left = (mouse.x - mouse.startX < 0) ? mouse.x + 'px' : mouse.startX + 'px';
            element.style.top = (mouse.y - mouse.startY < 0) ? mouse.y + 'px' : mouse.startY + 'px';
        }
    })
    .on("click", function(e){
        if(rectSelection){
            if (element !== null) {
                element = null;
                $(this).css("cursor", "default");
                console.log("finsihed.");
                rectSelection = false;
                $(".sidebar a#selection").removeClass('active')
            } else {

                console.log("begun.");
                
                mouse.startX = mouse.x;
                mouse.startY = mouse.y;
                element = document.createElement('div');
                element.className = 'rectangle'
                element.style.left = mouse.x + 'px';
                element.style.top = mouse.y + 'px';
                $(this).append(element)
                
            }
        }else if(drawRect){
            var len = drawArray.length;
            // console.log(len)
            if(len == 3){
                drawRect = false;
                drawArray = []
                $(".sidebar a#draw").removeClass('active')
                ctx.lineTo(mouse.x, mouse.y)
                ctx.closePath()
                ctx.stroke()
                $(this).css("cursor", "default");
                return;
            }
            else if(len>0){
                ctx.lineTo(mouse.x, mouse.y)
                ctx.stroke()
            }else if (len==0){
                ctx = document.getElementById("drawing-canvas").getContext("2d");
                ctx.beginPath()
                ctx.lineJoin = "miter"
                ctx.lineCap = 'round';
                ctx.moveTo(mouse.x, mouse.y)
            }
            // console.log(mouse.x, mouse.y, e.clientX, e.clientY)
            drawArray.push([mouse.x, mouse.y])
        }
    });

    var pressTimer, longPress=false;

    $(".skin_container a").mouseup(function(e){
            e.preventDefault();
            $('.skin_container a.active').removeClass('active');
            clearTimeout(pressTimer);
            if(longPress){
                longPress = false;
                return;
            }
            let key = $(this).attr('data-key');
            console.log(key);
            if(socket && socket.connected) {
                let event_data = {"key" : key};
                socket.emit('client_event', event_data);
            }
            return false;
        }).mousedown(function(e){
            e.preventDefault();
            // Set timeout
            
            let elm = $(this);
            elm.addClass('active');
            pressTimer = window.setTimeout(function() {
                let skey = elm.attr('data-secondary-key');
                console.log(skey);
                if(skey){
                    if(socket && socket.connected) {
                        let event_data = {"key" : skey};
                        socket.emit('client_event', event_data);
                    }
                    longPress = true;
                }
            },3000);
            return false; 
    }).click(function(e){  
        e.preventDefault();
        return;
    }).mouseleave(function(e){
        clearTimeout(pressTimer);
        $('.skin_container a.active').removeClass('active');
    });

    $(document).on('click', '#connection_modal_btn', function() {
        let con_id = null;
        if($(this).attr("data-connection-status") == true || $(this).attr("data-connection-status") == 'true') {
        //     console.log(CUR_CONNECTION_BTN)
            
            con_id = CUR_CONNECTION_BTN.closest(".cpm").attr("data-connection-id")
            //     CUR_CONNECTION_BTN.click()
            // setTimeout(function() {
                // console.log($(".connection-tab-"+con_id));
    
            // }, 1000)
        // } else {
            
        }
        getActiveSerialPortList(con_id, true);
    })
})

$(document).keydown(
    function(e)
    {    
        // console.log(e.keyCode);
        // console.log($(".elem_key.active").parent().index())
        if (e.keyCode == 39) {
            let nxtElem = $(".elem_key:focus").parent().next().find('.elem_key');
            if(nxtElem.length==0){
                nxtElem = $(".elem_key:focus").parent().parent().next().find('.elem_key:first')
            }
            // console.log(nxtElem);
            nxtElem.focus();
        }
        else if (e.keyCode == 37) {
            let prvElem = $(".elem_key:focus").parent().prev().find('.elem_key');
            if(prvElem.length==0){
                prvElem = $(".elem_key:focus").parent().parent().prev().find('.elem_key:last')
            }
            // console.log(prvElem);
            prvElem.focus();
        }
        else if(e.keyCode == 40){
            let indx = $(".elem_key.active").parent().index();
            // console.log(indx)
            let nxtElem = $(".elem_key:focus").parent().parent().next().find('.elem_key:eq('+indx+')')
            // console.log(nxtElem);
            nxtElem.focus();
        }
        else if(e.keyCode == 38){
            let indx = $(".elem_key.active").parent().index();
            // console.log(indx)
            let prvElem = $(".elem_key:focus").parent().parent().prev().find('.elem_key:eq('+indx+')')
            // console.log(prvElem);
            prvElem.focus();
        }
    });

$(document).on('click', '.send_hex_value', function() {
    let key = $(this).attr('data-key');
    let hexValue = document.getElementById("hex_value").value.split(' ').join('');
    if(/^[0-9a-fA-F]+$/.test(hexValue) && hexValue.length > 0) {
        if(socket && socket.connected) {
            if(hexValue.length % 2 == 0 ) {
                let event_data = {"key" : key, "hexValue": hexValue};
                socket.emit('client_event', event_data);
                document.getElementById("hex_value").value = "";
            } else {
                alert("Odd-length string")
            }
        }
    } else {
        if(hexValue.length > 0)
            alert("Non-hexadecimal digit found")
    }
});

$(document).on('click', '#logenabled', function() {
    if ($(this).attr('title') == "Enable log") 
    {
        isLogEnabled = true;
        $(this).attr('title', 'Disable log')
        $(this).html('<i class="fa fa-eye-slash fa-lg"></i>');
    } 
    else 
    {
        isLogEnabled = false;
        $(this).attr('title', 'Enable log')
        $(this).html('<i class="fa fa-eye fa-lg"></i>');
        // $(this).html('Enable Log');clear
    }
});	

$(document).on('click', '.sidebar a#capture', function(e) {
    e.preventDefault();
    var dateTime = new Date().toString("yyyy-MM-dd_HH:mm:ss")
    var a = document.createElement('a');
    var canvas = document.getElementById('video-canvas');
    var url = canvas.toDataURL('png');
    a.href = url;
    a.download = dateTime + "_adc_screenshot.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
});

$(document).on('click', '.sidebar a#selection', function(e) {
    e.preventDefault();
    rectSelection = true;
    $(".canvas-container").find('.rectangle').remove();
    $(".canvas-container").css("cursor", "crosshair");
    $(this).addClass('active')
});

$(document).on('click', '.sidebar a#draw', function(e) {
    e.preventDefault();
    drawRect = true;
    ctx = cvs.getContext("2d")
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    $(".canvas-container").find('.rectangle').remove();
    $(".canvas-container").css("cursor", "crosshair");
    $(this).addClass('active')
});

$(document).on('click', '#logsave', function() {
    let k = '';
    logArray.forEach(function(item){
        k+=item.innerHTML
    });
    
    $("#console-log p").each(function(){
        k += $(this).html();
    });
    var dateTime = new Date().toString("yyyy-MM-dd_HH:mm:ss")
    var html = k;
    // html = html.trim();
    html = html.replace(/<br>/g, "\r\n");
    // html = html.replace(/<[^>]*>/g, "");
    var a = document.createElement('a');
    var blob = new Blob([html], {type: "octet/stream"});
    var url = window.URL.createObjectURL(blob);
    a.href = url;
    a.download = dateTime + "_adc_console.log";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
});	

$(document).on('click', '#logclear', function() {
    var myNode = document.getElementById("console-log");
    while (myNode.firstChild) {
        myNode.removeChild(myNode.firstChild);
    }
});	

function connectDisconnectSocket(connect_btn, connection_id, conn_port=null) {
    let key = connect_btn.attr('data-key')
    let first_attempt = connect_btn.attr('data-first-attempt')
    let active_cpm = connect_btn.closest('.cpm')
    // console.log(connect_btn);
    if(key == 'connect') {
        if(first_attempt) {
            connection_port = conn_port
            socketConnect()
            connect_btn.attr('data-first-attempt', "false")
        } else {
            if(socket.io.connecting.indexOf(socket) === -1) {
                socket.connect();
            }
        }
        $("#connection_status_badge").find('span').text("Connected").removeClass("text-danger").addClass("text-success")
        $("#connection_modal_btn").html("Disconnect").removeClass("btn-info").addClass("btn-danger").attr("data-connection-status", "true")
        $(".cp_save_connect_btn").attr("disabled", true)
        connect_btn.attr('data-key', 'disconnect')
        connect_btn.html("Disconnect").removeClass("btn-secondary").addClass("btn-danger").removeAttr("disabled")
        $(".connection-tab-"+connection_id).attr("data-is-connected", true)
        CONNECTED_TO_SOCKET = true
        CUR_CONNECTION_BTN = connect_btn
        $(".int_key").removeAttr("disabled");
        $(".elem_key").removeAttr("disabled");
        $("input#search_term").removeAttr("disabled");
        
        active_cpm.find("#cp-port").attr("disabled", true)
        active_cpm.find("#cp-baudrate").attr("disabled", true)
        active_cpm.find("#cp-parity").attr("disabled", true)
        active_cpm.find("#cp-stopbit").attr("disabled", true)
        active_cpm.find("#cp-databit").attr("disabled", true)
        $("#startbtn").removeAttr("disabled");  
    } else if(key == 'disconnect') {
        // socket.emit('forceDisconnect')
        socket.disconnect();
        $("#connection_status_badge").find('span').text("Disconnected").removeClass("text-success").addClass("text-danger")
        $("#connection_modal_btn").html("Connect").removeClass("btn-danger").addClass("btn-info").attr("data-connection-status", "false")
        $(".cp_save_connect_btn").removeAttr("disabled")
        connect_btn.attr('data-key', 'connect')
        connect_btn.html("Save & Connect").removeClass("btn-danger").addClass("btn-secondary").removeAttr("disabled")
        $(".connection-tab-"+connection_id).attr("data-is-connected", false)
        CONNECTED_TO_SOCKET = false
        CUR_CONNECTION_BTN = null
        clearVideo()
        $(".int_key").attr("disabled", "true")
        $(".elem_key").attr("disabled", "true")
        $("input#search_term").attr("disabled", "true")

        active_cpm.find("#cp-port").removeAttr("disabled")
        active_cpm.find("#cp-baudrate").removeAttr("disabled")
        active_cpm.find("#cp-parity").removeAttr("disabled")
        active_cpm.find("#cp-stopbit").removeAttr("disabled")
        active_cpm.find("#cp-databit").removeAttr("disabled")

        if($('#startbtn').text() == "Stop")
            $('#startbtn').click();
        $("#startbtn").attr("disabled", "true");            
        // setTimeout(getActiveSerialPortList(connection_id, false), 3000);
        // return "disconnected"
    }
    // getActiveSerialPortList(connection_id, false)

}

function sendConnectSignal(){
    let event_data = {"key" : "Connect"};
    socket.emit('client_event', event_data);
    connectSignalTimer = setTimeout(sendConnectSignal, 60 * 1000); //every 1 min
}

var logArray = []

function socketConnect() {
    // var socket = io.connect('http://127.0.0.1:5000');
    socket = io(null, { transports: ['websocket'] });
    socket.on('connect',function() {
        console.log('Client has connected to the server! ID:' + socket.id);
        // user_id = socket.id;
        socket.emit('client_port', {"port": connection_port})
        sendConnectSignal()
        // let event_data = {"key" : "Connect"};
        // socket.emit('client_event', event_data);
    });

    socket.on('message',function(data) {
        console.log('Received a message from the server!', data);
    });

    socket.on('disconnect',function() {
        console.log('The client has disconnected!');
        clearTimeout(connectSignalTimer)
    });

    socket.on('connect_error', function(exception) {
        console.log("socket connection error");
        // socket.disconnect(true);
    });

    socket.on('forceDisconnect', function(){
        console.log('server force disconnect')
        socket.disconnect();
        clearVideo();
    });

    socket.on('consoleData', function(data) {
        if(isLogEnabled)
        {
            // var today = new Date();
            // var dateTime = "["+today.getFullYear()+'-'+("0" + (today.getMonth() + 1)).slice(-2)+'-'+("0" + (today.getDate() + 1)).slice(-2) + " " +
            //     ("0" + (today.getHours() + 1)).slice(-2) + ":" + ("0" + (today.getMinutes() + 1)).slice(-2) + ":" + 
            //     ("0" + (today.getSeconds() + 1)).slice(-2)+"]";
            var dateTime = '['+new Date().toString("MM/dd/yyyy HH:mm:ss")+']'
            

            var p = document.createElement("p");
            if(data.includes("Send"))
            {
                p.style.cssText = "color:purple;display:inline;";
                // p.innerHTML = dateTime + data + + "<br />"
                // data =  "<p style=\"color:purple;display:inline;\">" + " " + dateTime + data + "<br /></p>";
            }
            else if(data.includes("Received"))
            {
                p.style.cssText = "color:#206020;display:inline;";
                // data = "<p style=\"color:#206020;display:inline;\">" + " " + dateTime + data + "<br /></p>";
            }
            else
            {
                p.style.cssText = "color:black;display:inline;";
                // data = "<p style=\"color:black;display:inline;\">" + " " + dateTime + data + "<br /></p>";
            }
            p.innerHTML = dateTime + data + "<br />"
            // logArray.push(p)

            if($("#console-log p").length>=500){
                logArray.push($("#console-log p:eq(0)")[0])
                $("#console-log p:eq(0)").remove();
            }
            
            // document.getElementById("console-log").innerHTML += data;
            $("#console-log").append(p);
            // console.log(logArray)
            // $("#console-log").appendChild(logArray.join("<br>"));
            $('.console-tab-content').animate({
                scrollTop: $('#console-log').get(0).scrollHeight
            }, 100);
        }
        });

    socket.on('extract_info', function(data){
        if((elements_info[data.elem_name]['element_return_type'] == 'Dec') && 
            !(Object.keys(elements_info[data.elem_name]['element_value_map']).length) && elements_info[data.elem_name]['element_type'] != 'Array')
        {
            if(isPlotting)
            {
                if(elements_info[data.elem_name]['element_isplotting'])
                {
                    drawChart(data.elem_name, data.elem_val);
                    elements_info[data.elem_name]['element_isplotting'] = false;
                    currentTimeout[data.elem_name] = setTimeout(function() {
                        elements_info[data.elem_name]['element_isplotting'] = true
                    }, 1000)

                }
            }
            chartOption[data.elem_name] = data.elem_name;
        }
        try{
            elements_info[data.elem_name]['element_value'] = data.elem_val;
        }catch(err){
            console.log("++++"+data.elem_name);
        }
    });

}

var currentTimeout = {};
var video_loaded = false;
var player = null;

function loadVideo(cam_ws_port, cam_src_info) {
    video_loaded = true;
    feed_info = cam_src_info
    // feed_info = JSON.parse(feed_info);
    var canvas = document.getElementById('video-canvas');

    var url = 'ws://'+document.location.hostname+':'+cam_ws_port+'/';
    player = new JSMpeg.Player(url, 
            { canvas: canvas, seekable: true, pauseWhenHidden: false, 
                disableWebAssembly: true, disableGl: true, 
                //onEnded: onended, onStalled: onstalled, onSourceCompleted: onsourcecompleted,onPause : onpause, onPlay: onplay, 
                onSourceEstablished: onsourceestablished, 
            });
    // console.log(feed_info);
    if(Object.keys(feed_info).length){
        scaleCanvasVideo();
    }else{
        clearVideo();
    }
}

function captureScreenshot(){
    var canvas = document.getElementById('video-canvas');
    return canvas.toDataURL('png');

}

function resizeElements() {
    // console.log($('.skin_container').width());
    let k = $(".skin_container a:first");
    let left = $('.skin_container').width()/2-85;
    let top = 158;
    let width = 65;
    let height = 70;
    k.css('top', top);
    k.css('left', left);
    k = $(".skin_container a:eq(1)");
    let sleft = left + 130;
    k.css('top', top);
    k.css('left', sleft);
    k = $(".skin_container a:eq(2)");
    let stop = top + 75;
    k.css('top', stop);
    k.css('left', left);
    k = $(".skin_container a:eq(3)");
    k.css('top', stop);
    k.css('left', sleft);
    k = $(".skin_container a:eq(4)");
    stop = stop + 95;
    k.css('top', stop);
    k.css('left', left-10);
    k.css('width', width+15)
    k = $(".skin_container a:eq(5)");
    k.css('top', stop);
    k.css('left', sleft-15);
    k.css('width', width+25)
    k = $(".skin_container a:eq(6)");
    stop = stop + 95
    k.css('top', stop);
    k.css('left', left-5);
    k.css('height', height+20)
    k = $(".skin_container a:eq(7)");
    k.css('top', stop);
    k.css('left', left+65);
    k.css('height', height+20)
    k = $(".skin_container a:eq(8)");
    k.css('top', stop);
    k.css('left', left+135);
    k.css('height', height+20)
    k = $(".skin_container a:eq(9)");
    stop = stop + 118
    k.css('top', stop);
    k.css('left', left-5);
    k.css('height', height+10)
    k.css('width', width+15)
    k = $(".skin_container a:eq(10)");
    k.css('top', stop);
    k.css('left', left+125);
    k.css('height', height+10)
    k.css('width', width+15)
    k = $(".skin_container a:eq(11)");
    k.css('top', top-133);
    k.css('left', left-55);
    k.css('width', width-25)
    k = $(".skin_container a:eq(12)");
    k.css('top', top-133);
    k.css('left', sleft+85);
    k.css('width', width-25)
    var window_height = jQuery(window).height();
    // var new_height = parseInt(window_height)-(parseInt(247));
    $("#console-container").closest(".row").height(parseInt(window_height)/2)
    $(".canvas-container").closest(".row").height(parseInt(window_height)/2)
    $("#interface").find(".tab-content").height(parseInt(window_height)-parseInt(137))
    $(".canvas-container").height(parseInt($("#console-container").parent().height()))
    $("#console-container").height(parseInt($("#console-container").parent().height()- parseInt(17)))
    $("#console-container").find(".tab-content").height(parseInt($("#console-container").height())-parseInt(64))
    cvs.width = $(".canvas-container").width()
    cvs.height = $(".canvas-container").height()
    setTimeout(function() {
        let eleminfo_height = $(".eleminfo").height();
        if(eleminfo_height <=10) {
            eleminfo_height = 100
        }
        // console.log(eleminfo_height)
        var new_height = parseInt(window_height)-((parseInt(175)+parseInt(eleminfo_height)))
        $(".elemlist").height(new_height)
    }, 100)

}

function scaleCanvasVideo() {
    let cc = $(".canvas-container");
    let cc_width = cc.width();
    let cc_height = cc.height();
    /* console.log("cc width" + cc_width )
    console.log("feed width" + feed_info.width )
    console.log("cc height" + cc_height )
    console.log("feed height" + feed_info.height ) */
    // if(feed_info !== null) {
    // var s_width_ratio = parseInt(cc_width)/parseInt(feed_info.width)
    // let aspect_ratio = feed_info.height/feed_info.width;
    // let c_height = cc_width*aspect_ratio;
    // let s_height_ratio = parseInt(c_height)/parseInt(feed_info.height);
    // var s_height_ratio = parseInt(cc_height)/parseInt(feed_info.height)
    // } else { clearVideo() }

    if(video_loaded) {
        if(feed_info !== null) {
            var s_width_ratio = parseInt(cc_width)/parseInt(feed_info.width)
            var s_height_ratio = parseInt(cc_height)/parseInt(feed_info.height)
            $("#video-canvas").css('transform', 'scale('+s_width_ratio+', '+s_height_ratio+')')
        }
        // $(".canvas-container").attr('width', cc_width).attr('height', cc_height)
    } else {
        $("#video-canvas").attr('width', cc_width).attr('height', cc_height)
    }
    $("#video-canvas").css('transform-origin', '0% 0%')
    // $(".canvas-container").height(cc_height)
}

$(function() {
    // $("#video-canvas").attr("width", $(".canvas-container").width()-15);
    // $("#video-canvas").attr("height", "400");
    resizeElements()
    $( window ).resize(function() {
        resizeElements();
        scaleCanvasVideo(); 
    });
});

function onsourceestablished() {
    var video_loaded = true;
    console.log("Play source established");
}

function clearVideo() {
    setTimeout(function() {
        let canvas1 = document.getElementById("video-canvas");
        context = canvas1.getContext("2d");
        context.save();
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas1.width, canvas1.height);
        context.restore();
    }, 500);
    if(player && typeof player !== 'undefined') {
        player.destroy();
    }
}

function processValue(value, calculation)
{
    if(calculation){
        var mul = parseFloat(calculation.split('|')[0]);
        var sub = parseFloat(calculation.split('|')[1]);
        value = (value*mul) - sub;
        precision = mul.toString().split('.')[1].length
        var multiplier = Math.pow(10, precision || 0);
        return Math.round(value * multiplier) / multiplier;
    }
    return value;
    // return valuePrint
}

function update_elem_val(event) {
    let updatedValue = $("#value_map").val();
    // console.log(updatedValue)
    //------------------validation---------------------------
    if(updatedValue && event.data.rettype=='Dec'){
        $("#input_error_msg").html("");
        var regex = new RegExp("^(-)?[0-9]\\d*(\\.\\d+)?$");
        if(!regex.test(updatedValue)){
            $("#input_error_msg").html('Only numbers with optional decimal points are allowed');
            return;
        }
        if(event.data.type[0]=='S'){
            // console.log('signed')
            let max_val = (Math.pow(2, parseInt(event.data.type.substr(1))))/2-1
            max_val = processValue(max_val, event.data.calculation)
            let min_val = -max_val
            if(updatedValue<min_val || updatedValue>max_val){
                // console.log('Value must be within '+min_val+' and '+max_val);
                $("#input_error_msg").html('Value must be within '+min_val+' and '+max_val)
                return;
            }
        }else if(event.data.type[0]=='U'){
            // console.log('unsigned')
            let max_val = Math.pow(2, parseInt(event.data.type.substr(1)))-1
            max_val = processValue(max_val, event.data.calculation)
            let min_val = 0
            if(updatedValue<min_val || updatedValue>max_val){
                // console.log('Value must be within '+min_val+' and '+max_val);
                $("#input_error_msg").html('Value must be within '+min_val+' and '+max_val)
                return;
            }
        }
    }else if(updatedValue && event.data.rettype=='Hex'){
        $("#input_error_msg").html("");
        var regex = new RegExp("^[0-9a-fA-F]+$");
        if(!regex.test(updatedValue)){
            $("#input_error_msg").html('Only hex numbers are allowed');
            return;
        }
        let bitLimit = parseInt(event.data.type.substr(1))/4;
        if(updatedValue.length>bitLimit){
            $("#input_error_msg").html('Only '+bitLimit+' hex bits are allowed');
            return;
        }
    }
    //----------------------------------------------------------

    let binaryString = '';
    // console.log($('.custom-btn-toggle:not(#value_map)').length)
    if($('.custom-btn-toggle:not(#value_map)').length){
        $('.custom-btn-toggle:not(#value_map)').each(function(){
            binaryString += $(this).val();
        });
    }else if($('.custom-input-text').length){
        $('.custom-input-text').each(function(){
            binaryString += $(this).val();
        });
    }
    // console.log(binaryString);

    if (event.data.rettype == 'Hex'){
        updatedValue = parseInt(updatedValue, 16);
    }else if(event.data.rettype == 'Bin'){
        binaryString = binaryString.padEnd(event.data.size, '0')
        updatedValue = parseInt(binaryString, 2);
    }

    if(socket && socket.connected) {
        let event_data = {elementValue: updatedValue, elementID:event.data.elmid};
        console.log(event_data);
        socket.emit('update_event', event_data);
    }
}

$(document).on('click focus', '.elem_key', function() {
    resizeElements()
    $('.elem_key.active').removeClass('active');
	$(this).addClass('active');
    let data_id = $(this).attr('data-id');
    let key = $(this).text();
    let retType = elements_info[key].element_return_type
    let size = elements_info[key].element_size
    let type = elements_info[key].element_type
    let calculation = elements_info[key].element_calculation
    // console.log();
    let dynamicElemInfo = '<div class="row mt-2"><label id="selectedElement"><b>'+key+'</b></label></div>';
    // console.log(Object.keys(elements_info[key].element_child).length);
    if (elements_info[key].element_child.element_child_name.length){
        let value = elements_info[key].element_value//.split("").reverse().join("");
        // console.log(value)
        let childList = elements_info[key].element_child;
        // console.log(childList);
        var cell_count=0; 
        var current_row_count=0;
        var total_row_count=Math.ceil(childList.element_child_name.length/4);
        dynamicElemInfo += "<div class='row mt-2'>";
        // for(var i=childList.element_child_name.length-1;i>=0;i--){
        // console.log(value);
        // for(var i=size-1;i>=0;i--){
        for(var i=0;i<size;i++){
            // console.log(childList.element_child_name[i]);
            if(childList.element_child_name[i] == undefined){
                continue;
            }
            if (childList.element_child_rw[i].indexOf('Write')>-1){
                rwClass ='enable';
            }else{
                rwClass='disable';
            }
            if(Object.keys(childList.element_child_value_map[i]).length){
                childList.element_child_value[i] = value[i];
                childButtonLabel = childList.element_child_value_map[i][childList.element_child_value[i]];
                dynamicElemInfo += "<div class='col-3 text-center'> \
                    <button value="+childList.element_child_value[i]+" data-map='"+JSON.stringify(childList.element_child_value_map[i])+"' class='btn custom-btn-toggle btn-outline-secondary "+rwClass+"'>"+childButtonLabel+"</button><br><label class='child_label'>"+childList.element_child_name[i].split("_")[1]+"</label> \
                </div>";
            }else{
                var mValue = [];
                var strValue = null;
                var startIndex = parseInt(childList.element_child_start_bit[i], 10);
                var endIndex = parseInt(childList.element_child_end_bit[i], 10);
                
                if(retType == 'Dec' || retType == 'Hex'){
                    let index = startIndex
                    while(index <= endIndex)
                    {
                        mValue.push(value[index]);
                        index += 1;
                    }
                    listValue = mValue.join('');
                    strValue = parseInt(listValue, 2);
                    if (retType == 'Hex'){
                        // console.log(strValue)
                        strValue = '0x' + strValue.toString().padStart((endIndex-startIndex+1)/4, '0')
                    }
                    if(rwClass == 'disable'){
                        rwClass = 'readonly'
                    }
                    dynamicElemInfo += "<div class='col-3 text-center'> \
                        <input type='text' class='custom-input-text' value="+strValue+" "+rwClass+"><br><label class='child_label'>"+childList.element_child_name[i].split("_")[1]+"</label> \
                    </div>";
                }else if(retType == 'Bin'){
                    strValue = value[i];
                    let custom_data_map={"0":0,"1":1};
                    dynamicElemInfo += "<div class='col-3 text-center'> \
                        <button value="+childList.element_child_value[i]+" data-map='"+JSON.stringify(custom_data_map)+"' class='btn custom-btn-toggle btn-outline-secondary "+rwClass+"'>"+strValue+"</button><br><label class='child_label'>"+childList.element_child_name[i].split("_")[1]+"</label> \
                    </div>";
                }

                
            }
            cell_count+=1;
            if (cell_count%4==0 || cell_count==childList.element_child_name.length){
                dynamicElemInfo+="</div>";
                current_row_count+=1;
                if (current_row_count<total_row_count){
                    dynamicElemInfo += "<div class='row mt-2'>";
                }
            }
        }
        if(elements_info[key].element_rw.indexOf('Write')>-1){
            dynamicElemInfo += "<div class='row mt-2'><div class='col-12 text-center'><button class='btn btn-info updatebtn'>Update</button></div></div>";
        }
    }else{
        // console.log(elements_info[key].element_value_map);
        let value = elements_info[key].element_value;
        let strValue = '';
        // console.log("------"+value);
        let input_container = '';
        if(elements_info[key].element_value_map[value]){
            // console.log(elements_info[key].element_value_map);
            strValue = elements_info[key].element_value_map[value];
            if (Object.keys(elements_info[key].element_value_map).length == 2){
                if (elements_info[key].element_rw.indexOf('Write')>-1){
                    rwClass ='enable';
                }else{
                    rwClass='disable';
                }
                input_container += "<button value="+value+" id='value_map' data-map='"+JSON.stringify(elements_info[key].element_value_map)+"' class='btn custom-btn-toggle width-auto btn-outline-secondary "+rwClass+"'>"+strValue+"</button>";
            }else{
                
                input_container += '<select id="value_map">';
                Object.keys(elements_info[key].element_value_map).forEach(function(item){
                    if (value == item){
                        input_container+='<option value='+item+' selected>'+elements_info[key].element_value_map[item]+'</option>';
                    }else{
                        input_container+='<option value='+item+'>'+elements_info[key].element_value_map[item]+'</option>';
                    }
                });
                input_container+='</select>';
                    $('#value_map').selectmenu();
            }
        }else{
            if (retType == 'Hex'){
                prefix = "<b>0x</b>";
            }else{
                prefix = '';
            }
            input_container += prefix+'<input type="text" id="value_map" class="input-group-sm" value='+value.toString().replace("0x","")+'>';
            // input_container += '<br><span id="input_error_msg"></span>';
        }
        if(elements_info[key].element_rw.indexOf('Read')>-1){
            value = strValue ? strValue:value;
            dynamicElemInfo +=' \
            <div class="row p-1"> \
                <div style="" class="text-left col-md-2 col-3"><label class="elementCurrentlabel">Current Value: </label></div> \
                <div style="" class="text-left col-md-10 col-9"><label class="elementCurrentVal">'+value+' '+elements_info[key].element_unit+'</label></div> \
            </div>';
        }
        if(elements_info[key].element_rw.indexOf('Write')>-1){
            
            dynamicElemInfo +=' \
                <div class="row p-1"> \
                    <div style="" class="text-left col-md-2 col-3"><label class="elementUpdateVal">New Value: </label></div> \
                    <div style="" class="text-left elementUpdateVal col-md-10 col-9">'+input_container+' '+elements_info[key].element_unit+'<button class="btn btn-info updatebtn">Update</button><br><span id="input_error_msg"></span></div> \
                </div>';
        }
        // console.log('no child');
    }
    $(".eleminfo").html(dynamicElemInfo);
    // console.log($('.updatebtn'));
    // console.log(data_id);
    $('.updatebtn').bind('click', { elmid: data_id, rettype: retType, type: type, size: size, calculation: calculation }, update_elem_val);

    $('.custom-btn-toggle.enable').on('click', function(){
        let datamap = JSON.parse($(this).attr("data-map"));
        currentval = $(this).text();
        if (datamap[Object.keys(datamap)[0]] == currentval){
            $(this).html(datamap[Object.keys(datamap)[1]]);
            $(this).attr('value', Object.keys(datamap)[1])
        }else{
            $(this).html(datamap[Object.keys(datamap)[0]]);
            $(this).attr('value', Object.keys(datamap)[0])
        }
    });
});


var chartOption = {};
var selectedItemsParams = [];
var chartData = {};
var isPlotting = false;
var chartPlotted = {}

$(document).on('click', '#startbtn', function() {
    if ($('#startbtn').text() == "Start") 
    {
        chartPlotted = {};
        chartData = {};
        printChecked();
        if(selectedItemsParams.length < 1)
        {
            alert("Please select atleast one item!!!")
            return;
        }
        isPlotting = true;
        $(this).html('Stop');
        deleteChild();
        $(this).removeClass('btn-outline-info').addClass('btn-outline-danger');
        $("#checkboxcontainer #chart-list-alert").html('<i class="fa fa-refresh fa-spin"></i>  Waiting for data');
        
        

        selectedItemsParams.forEach(element => {
            var myarray = [];
            var value = [];
            elements_info[element]['element_isplotting'] = true;
            myarray.push(dataPoint(element, value, colorArr[colorIndex%8]));
            createChart(element, myarray);
            colorIndex++;
        });

        //Fit initialy created chart to container
        for(var key in chartPlotted)
        {
            chartPlotted[key].reflow();
        }
    } 
    else 
    {
        isPlotting = false;
        for(key in chartDataToPlot)
        {
            clearTimeout(currentTimeout[key])
            chartDataToPlot[key] = null;
        }

        chartData = {};
        $(this).html('Start');
        $(this).removeClass('btn-outline-danger').addClass('btn-outline-info');
        $("#checkboxcontainer #chart-list-alert").html('<i class="fa fa-ban"></i>  Stopped receiving data');
    }
});	

$(document).on('click', '.chart', function() {
    createChk(chartOption);
});	

$(document).on('click', '.refresh', function() {
    createChk(chartOption);
});

$(document).on('click', '#checkboxcontainer input', function() {
    var value = [];
    var myarray = [];
    if(isPlotting) {
        if($(this).is(":checked"))
        {
            elements_info[$(this).val()]['element_isplotting'] = true;
            selectedItemsParams.push($(this).val())
            if(!chartPlotted["chart_" + $(this).val()])
            {
                if(colorIndex%8 == 0)
                {
                    colorIndex = 0;
                }
                // selectedItemsParams.push($(this).val());
                myarray.push(dataPoint($(this).val(), value, colorArr[colorIndex%8]));
                createChart($(this).val(), myarray);
                colorIndex++;
            }
        }
        else
        {
            clearTimeout(currentTimeout[$(this).val()])
            elements_info[$(this).val()]['element_isplotting'] = false;
            delete selectedItemsParams[selectedItemsParams.findIndex(x => x == $(this).val())]
        }
    }
});

function deleteChild() { 
    var myNode = document.getElementById("chartcontainer");
    while (myNode.firstChild) {
        myNode.removeChild(myNode.firstChild);
    }
}

var colorArr = ['#3366ff', '#cc66ff', '#ffcc00', '#66ffff', '#009999', '#339933', '#ff0066', '#cc3300'];
var colorIndex = 0;

function drawChart(elementName, plotData)
{
    var myarray = [];
    var value = [];
    if(colorIndex%8 == 0)
    {
        colorIndex = 0;
    }
    value.push(parseFloat(plotData));	
    myarray.push(dataPoint(elementName, value, colorArr[colorIndex%8]));
    createChart(elementName, myarray);
    colorIndex++;
}

function printChecked(){
    var items=document.getElementsByName('parameterValue');
    selectedItemsParams = [];
    for(var i=0; i<items.length; i++){
        if(items[i].type=='checkbox' && items[i].checked==true)
            selectedItemsParams.push(items[i].value);
    }
}

function dataPoint(name, data, colorcode){
    let obj = {};
    obj.name = name;
    obj.data= data;
    obj.color = colorcode;
    return obj;
}

function createChk(data) {
    if(Object.keys(data).length) {
        $("#checkboxcontainer #chart-list-alert").hide();
    }
    for(key in data)
    {
        if(!($('#'+key).length))
        {   
            let chk = '<a class="list-group-item">\
                            <div class="form-check">\
                                <input type="checkbox" id="'+key+'" value="'+key+'" name="parameterValue" class="form-check-input" id="exampleCheck1">\
                                <label class="form-check-label break-all" for="'+key+'" class="break-all">'+key+'</label>\
                            </div>\
                       </a>'

            $("#checkboxcontainer .list-group").append(chk);
        }
    }
}

var chartDataToPlot = {};

function createChart(key, seriesValue) {
    Highcharts.setOptions(Highcharts.theme);
    var originalKey = key;
    var unit = "";
    if(elements_info[originalKey].element_unit.length > 0)
    {
        unit = "Unit (" + elements_info[originalKey].element_unit + ")"
    }
    else
    {
        unit = "Unit"
    }

    key = "chart_" + key.toString();
    
    if($('#'+key).length && chartPlotted[key])
    {
        if(!chartDataToPlot[key]){
            chartDataToPlot[key] = []
        }
        var chartLength = Object.keys(chartDataToPlot[key]).length;
        chartDataToPlot[key].push([chartLength + 1 ,seriesValue[0].data[0]])
        if(chartDataToPlot[key].length <= 300){
            chartPlotted[key].series[0].setData($.extend(true, [], chartDataToPlot[key]), true, false);
        }else{
            chartPlotted[key].series[0].addPoint([chartLength + 1, seriesValue[0].data[0]], true, true);
        }
    } 
    else
    {
        $("#chartcontainer").append("<div class='chart-single mb-5' id='"+key.toString()+"'></div>");
        chartPlotted[key] = Highcharts.stockChart(key.toString() , {
            legend: {
                enabled: false
            },

            chart: {
                animation: false
            },

            tooltip: { 
                headerFormat: ""
            },

            title: {
                text: originalKey,
                style: {
                fontFamily: 'Times New Roman',
                fontSize: 18,
                fontWeight: 'normal',
                textTransform: 'none'
                }
            },

            xAxis: {
                lineWidth: 1,
                labels: {   
                    style: {
                        fontSize:'15px'
                    },
                    formatter: function () 
                    {
                      return this.value;
                    }
                },
                allowDecimals: false,
                scrollbar: {
                    showFull: false,
                    minWidth: 1
                }, 
                crosshair: {
                    width: 0
                },
                ordinal: false                
            },

            yAxis: {
                lineWidth: 1,
                title: {
                    text: unit,
                    style: {
                    fontFamily: 'Brandon Text Bold',
                    fontSize: 18,
                    fontWeight: 'normal',
                    textTransform: 'none',
                    color: '#ffffff'
                    }
                },
                labels: {
                    style: {
                        fontSize:'15px'
                    }
                },
                opposite: false,
                scrollbar: {
                    showFull: false
                }
            },

            plotOptions: {
                series: {
                    label: {
                        connectorAllowed: false
                    },
                    pointStart: 1,
                    marker: {
                        enabled: true,
                        radius: 2
                    }
                },
                dataLabels: {
                    enabled: false
                }
            },

            rangeSelector: {
                enabled:false
            },

            navigator: {
                height: 35,
                xAxis:{
                    labels: false
                }
            },

            exporting: {
                buttons: {
                    contextButton: {
                        menuItems: ['printChart', 'viewFullscreen', 'separator', 'downloadPNG',
                        { 
                            "text": "Download CSV file",
                            onclick: function() {
                                var rows = [
                                    ["Data Count", originalKey, "\r\n"]
                                ];
                                var i =1;
                                chartDataToPlot[key].forEach(function(rowArray) {
                                    let row = i + "," + rowArray[1];
                                    rows += row + "\r\n";
                                    i++;
                                });

                                var hiddenElement = document.createElement('a');
                                hiddenElement.href = 'data:text/csv;charset=utf-8,' + encodeURI(rows);
                                hiddenElement.target = '_blank';
                                hiddenElement.download = originalKey + '.csv';
                                document.body.appendChild(hiddenElement);
                                hiddenElement.click();
                                document.body.removeChild(hiddenElement);
                            }
                        }]
                    }
                }
            },

            series: seriesValue
        });
    }
}

$(function() {
    $(document).on('mouseover', '.highcharts-navigator', function() {
        $('.modal-content').draggable({ disabled: true });
    })
    $(document).on('mouseout', '.highcharts-navigator', function() {
        $('.modal-content').draggable("enable");
    })

    var resizeTimer;
    $('#chart-modal .modal-content').resizable({
        minHeight: 420,
        minWidth: 400
    }).on('resize', function (e) {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            resizeChartModalContent()
        }, 50);
    });

    $('#chart-modal .modal-content').draggable()

    resizeChartModalContent()

    function resizeChartModalContent() {
        resizeCharts()

        let content_h = parseInt($("#chart-modal .modal-content").height())
        content_h -= 100
        $("#chart-modal .modal-body").height(content_h)
        $("#chart-modal .modal-body .row").height(content_h)
        $("#chart-modal .col-md-8").height(content_h)
        $("#checkboxcontainer").height(content_h)
        // $("#chartcontainer").height(content_h)
        $("#chart-modal .custom-list-group").height(content_h)
    }

    function resizeCharts() {
        $( ".chart-single" ).each(function( index ) {
            for(var key in chartPlotted)
            {
                chartPlotted[key].reflow();
            }
        })
    }
})