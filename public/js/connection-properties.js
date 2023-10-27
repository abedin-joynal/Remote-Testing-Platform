$(function() {
    // var connection_live_icon = '<i class="fas fas-circle text-danger float-right pt-1 blink_me"></i>'
    var connection_live_icon = ''
    loadTabContent();

    $('#connection-list').on('click', '.list-group-item', function() {
        let con_info = $(this).attr("data-connection-info")
        let is_connected = $(this).attr("data-is-connected")
        let connection_id = $(this).attr("data-connection-id")
        if(con_info) {
            con_info = JSON.parse(con_info);
        } else {
            con_info = null;
        }
        loadTabContent(con_info, is_connected, connection_id);
        // getActiveSerialPortList(connection_id)
    });

    function loadTabContent(con_info = null, is_connected = false, connection_id) {
        let cpm = $("#connection-properties-markup").html();
        setTimeout(function() {
            $('#connection-list').find(".tab-content").find(".tab-pane").filter(".active").html(cpm);
            let active_cpm = $('#connection-list').find(".tab-content").find(".tab-pane").filter(".active").find(".cpm");
            active_cpm.attr("data-connection-id", connection_id)

            if(con_info !== null) {
                active_cpm.attr("data-new-connection", "false")
                active_cpm.attr("data-connection-name", con_info.connection_name)
                active_cpm.attr("data-connection-id", con_info.connection_id)
                // active_cpm.find("#cp-port").val(con_info.port).find("span").html(con_info.port)
                active_cpm.find("#cp-baudrate").val(con_info.baudrate).find("span").html(con_info.baudrate)
                active_cpm.find("#cp-parity").val(con_info.parity).find("span").html(con_info.parity)
                active_cpm.find("#cp-stopbit").val(con_info.stopbits).find("span").html(con_info.stopbits)
                active_cpm.find("#cp-databit").val(con_info.databits).find("span").html(con_info.databits)
            } else {
                active_cpm.attr("data-new-connection", "true")
                active_cpm.attr("data-connection-id", false)
                active_cpm.find(".cpm-message").after($("#new-connection-input-markup").html())
                active_cpm.find(".cp_delete").remove();
            }

            if(is_connected == true || is_connected == 'true') {
                active_cpm.find("#cp-port").val(con_info.port).find("span").html(con_info.port)
                active_cpm.find(".cp_save_connect_btn").html("Disconnect").removeClass("btn-secondary").addClass("btn-danger").attr("data-key", "disconnect").removeAttr("disabled")
                active_cpm.find(".cp_delete").attr("disabled", true)
                active_cpm.find("#cp-port").attr("disabled", true)
                active_cpm.find("#cp-baudrate").attr("disabled", true)
                active_cpm.find("#cp-parity").attr("disabled", true)
                active_cpm.find("#cp-stopbit").attr("disabled", true)
                active_cpm.find("#cp-databit").attr("disabled", true)

            }
        }, 200);
        return false;
    }

    $(document).on('keyup', '.new-connection-input', function() {
        let active_cpm = $(this).closest(".cpm")
        let new_con_name = active_cpm.find(".new-connection-input").val()
        active_cpm.attr("data-connection-name", new_con_name)
    });

    $(document).on('click', '.cp_save_connect_btn', function() {
        let key = $(this).attr('data-key')
        let cpm = $(this).closest(".cpm")
        let connection_id = cpm.attr("data-connection-id")
        let cpm_msg = cpm.find(".cpm-message")
        // console.log(connection_id)

        if(isEmpty(cpm.attr("data-connection-name"))) {
            cpm_msg.show().html("<i class='fa fa-exclamation-triangle'></i> Empty Connection Name").removeClass("alert-primary").addClass("alert-danger")
            return;
        }else if(!connection_id && isDuplicateConName(cpm.attr("data-connection-name"))) {
            cpm_msg.show().html("<i class='fa fa-exclamation-triangle'></i> Duplicate Connection Name").removeClass("alert-primary").addClass("alert-danger")
            return;
        }
        

        if(isEmpty(cpm.find("#cp-port").val()) || isEmpty(cpm.find("#cp-baudrate").val()) || 
           isEmpty(cpm.find("#cp-parity").val()) || isEmpty(cpm.find("#cp-stopbit").val()) || 
           isEmpty(cpm.find("#cp-databit").val())) {
           cpm_msg.show().html("<i class='fa fa-exclamation-triangle'></i> Missing Connection Parameters").removeClass("alert-primary").addClass("alert-danger")
           return;
        }
       
        // let connection_status = connectDisconnectSocket($(this), connection_id)
        if(key == 'disconnect') {
            let disconnect_btn = $(this);
            // $.ajax({
            //     type: 'json',
            //     method: 'post',
            //     url: "/close-connection",
            //     data: {connection_ip: $("#client_ip").val(), connection_port: cpm.find("#cp-port").val()},
            // }).done(function(res) {
            //     res = JSON.parse(res)
            //     console.log(res)
            //     if(res.status == true) {
            connectDisconnectSocket(disconnect_btn, connection_id)
            console.log("returned due to disconnect")
            cpm_msg.show().html("<i class='fa fa-check'></i> Disconnected Successfully.").removeClass("alert-danger").addClass("alert-primary")
            cpm.find(".cp_delete").removeAttr("disabled")
            $(".connection-tab-"+connection_id).find('.fas').remove()
            getActiveSerialPortList(connection_id, false)
            // }
            // });
            return;
        }
        let connect_btn = $(this);
        let connection_param = {}
        let connection_optional_param = {}
        // connection_param['socket_id'] = socket.id
        connection_param['connection_id'] = cpm.attr("data-connection-id")
        connection_param['connection_name'] = cpm.attr("data-connection-name")
        connection_param['ip'] = $("#client_ip").val()
        connection_param['agent'] = $("#client_agent").val()
        connection_param['port'] = cpm.find("#cp-port").val()
        connection_optional_param['baudRate'] = parseInt(cpm.find("#cp-baudrate").val())
        connection_optional_param['parity'] = cpm.find("#cp-parity").val()
        connection_optional_param['stopBits'] = parseInt(cpm.find("#cp-stopbit").val())
        connection_optional_param['dataBits'] = parseInt(cpm.find("#cp-databit").val())
        connection_param['optional_param'] = connection_optional_param

        $.ajax({
            type: 'json',
            method: 'post',
            url: "/save-connection",
            data: {connection_param: JSON.stringify(connection_param)},
        }).done(function(res) {
            res = JSON.parse(res)
            // console.log(res)
            if(res.status == true) {
                connectDisconnectSocket(connect_btn, connection_id, connection_param['port'])
                if (res.cam_ws_port && res.cam_src_info)
		            loadVideo(res.cam_ws_port, res.cam_src_info)
                let con_info = res.con_info
                // console.log(con_info)
                let json_str = JSON.stringify(con_info)
                let lgi = `<a class="list-group-item list-group-item-action connection-tab-`+con_info.id+`" id="list-profile-list" data-toggle="list" href="#list-profile"
                data-is-connected="true" data-connection-id="`+con_info.id+`" data-connection-name="`+con_info.connection_name+`"  data-connection-info='`+json_str+`'
                role="tab" aria-controls="profile"><i class="fa fa-caret-right"></i> `+con_info.connection_name+` `+connection_live_icon+`</a>`;
                if(res.new_con !== false) {
                    $("#connection-list").find(".list-group").append(lgi)
                    $("#connection-list").find(".list-group-item").last().click()
                    setTimeout(function() {
                        let added_cpm = $('#connection-list').find(".tab-content").find(".tab-pane").filter(".active").find(".cpm");
                        added_cpm.find(".cpm-message").show().html("<i class='fa fa-check'></i> Connection creation successfull.").removeClass("alert-danger").addClass("alert-primary")
                        added_cpm.find(".cp_delete").attr("disabled", true)
                    }, 300)
                } else {
                    // if(connection_status == 'connected') {
                        cpm_msg.show().html("<i class='fa fa-check'></i> Saved & Connected Successfully.").removeClass("alert-danger").addClass("alert-primary")
                        cpm.find(".cp_delete").attr("disabled", true)
                        $(".connection-tab-"+connection_id).replaceWith(lgi)
                        $(".connection-tab-"+connection_id).addClass('active')
                        // $(".connection-tab-"+connection_id).append(connection_live_icon)
                    // } 
                    // else {
                    //     cpm_msg.show().html("<i class='fa fa-check'></i> Disconnected Successfully.").removeClass("alert-danger").addClass("alert-primary")
                    //     cpm.find(".cp_delete").removeAttr("disabled")
                    // }
                }
            }else{
                console.log(res.err)
                cpm_msg.show().html("<i class='fa fa-exclamation-triangle'></i> "+res.err).removeClass("alert-primary").addClass("alert-danger")
            }
            getActiveSerialPortList(connection_id, false)
        });
    });

    $(document).on('click', '.cp_delete', function() {
        let cpm = $(this).closest(".cpm")
        let connection_id = cpm.attr("data-connection-id")
        let cpm_msg = cpm.find(".cpm-message")
        $.ajax({
            type: 'json',
            method: 'post',
            url: "/delete-connection",
            data: {connection_id: connection_id},
            beforeSend:function() {},
            success: function(res) {
                res = JSON.parse(res)
                if(res.status == true) {
                    // console.log(".connection-tab-"+connection_id)
                    $(".connection-tab-"+connection_id).remove()
                    $("#connection-list").find(".list-group-item").first().click();
                    showMsgOnActiveTab("<i class='fa fa-check'></i> Connection was deleted successfully.")
                }
            }
        })
    });    

    $(document).on('click', '.dropdown-menu a:not(.disabled)', function() {
        var text = $(this).html();                
        var htmlText = text + ' <span class="caret"></span>';
        $(this).closest('.btn-group').find('.dropdown-toggle').find("span").html(htmlText).val(text);
        $(this).closest('.btn-group').find('.dropdown-toggle').val(text);
    });

    $(document).ready(function() {
        let obj = $('.dropdown-menu a');
        $.each( obj, function( key, value ) {            
            var attr = $(this).attr('selected');
            if (typeof attr !== typeof undefined && attr !== false) {
                //  $(this).closest(".dropdown-toggle").html($(this).html())
            }
        });
    });

    function showMsgOnActiveTab(msg) {
        setTimeout(function() {
            let added_cpm = $('#connection-list').find(".tab-content").find(".tab-pane").filter(".active").find(".cpm");
            let added_cpm_msg = added_cpm.find(".cpm-message")
            added_cpm_msg.show().html(msg).removeClass("alert-danger").addClass("alert-primary")
        }, 300)
    }

    function isDuplicateConName(name) {
        let obj = $("#connection-list").find(".tablist").find("a")
        var res = false
        $.each( obj, function( key, value ) {
            // $(value).hide()
            if($(value).attr("data-connection-name") == name) {
                // console.log($(value).attr("data-connection-name"))
                // console.log(name)
                res = true
            }
        });
        return res
    }

    function isEmpty(str) {
        return (!str || 0 === str.length);
    }
});