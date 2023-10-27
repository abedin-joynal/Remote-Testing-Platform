$(document).ready(function() {
    
    /* Voice Transmission */
    var mediaRecorder;
    var volumeBarNode;
    $(document).on('click', '.voice-transmit-btn', function() {
        let transmission_status = $(this).attr('data-transmission-status');
        console.log(transmission_status);
        if(transmission_status == "false") {
            $(this).attr('data-transmission-status', "true");
            if(socket.connected) {
                socket.emit('start-transmission', {"user_id" : user_id});
            }
        } else {
            $(this).attr('data-transmission-status', "false");
            socket.emit('stop-transmission', true);
        }
    });
    /* Voice Transmission */
});


function start_voice_transmission() {
    var constraints = { audio: true };
    navigator.mediaDevices.getUserMedia(constraints).then(function(mediaStream) {
        detectVolumeLevel(mediaStream);

        mediaRecorder = new MediaRecorder(mediaStream);
        mediaRecorder.onstart = function(e) {
            this.chunks = [];
        };
        mediaRecorder.ondataavailable = function(e) {
            this.chunks.push(e.data);
            let c = [];						
            c.push(e.data);
            var blob = new Blob(c, { 'type' : 'audio/webm; codecs=opus' });
            // var audioUrl = URL.createObjectURL(blob);
            if(socket.connected) {
                socket.emit('voice', {'blob':e.data,'user_id': user_id});
            }
        };
        
        mediaRecorder.onstop = function(e) {
            /*
            let c = [];
            var blob = new Blob(this.chunks, { 'type' : 'audio/webm;codecs=opus' });
            // const audioUrl = URL.createObjectURL(blob);
            socket.emit('radio', blob);
            */
        };

        // Start recording
        mediaRecorder.start(1000);
    });
}

function vt_socket_events() {
    /* Voice Transmission */
    socket.on('voice-transmission-engaged',function(data) {
        console.log('voice-transmission-engaged : ', data.current_transmitting_user);
        current_transmitting_user = data.current_transmitting_user;
        if(data.current_transmitting_user !== user_id) {
            $(".voice-transmit-btn").attr("disabled", true);
        }
        start_voice_transmission();
        toastr.clear();
        toastr.info('Setting Up Voice Transmission.Please Wait..');
    });
    
    socket.on('voice-transmission-started',function(data) {
        console.log('voice-transmission-started : ', data.current_transmitting_user);
        current_transmitting_user = data.current_transmitting_user;
        // $("#volume-bar-wrapper").show();
        if(data.current_transmitting_user == user_id) {
            $(".voice-transmit-btn").find("i").removeClass("fa-microphone").addClass("fa-square").addClass("text-danger");
            // toastr.clear();
            toastr.success('You may speak now.');
            // startVR();
        }
    });

    socket.on('voice-transmission-released',function(data) {
        console.log('voice-transmission-released');
        mediaRecorder.stop();
        volumeBarNode.disconnect();
        $("#volume-bar-wrapper").hide();
        $(".voice-transmit-btn").removeAttr("disabled");
        $(".voice-transmit-btn").find("i").removeClass("fa-square").addClass("fa-microphone").removeClass("text-danger");
        toastr.clear();
        toastr.success('Voice transmission stopped.');
    });
    /* Voice Transmission */
}

function detectVolumeLevel(stream) {
    let audioContext = new AudioContext();
    analyser = audioContext.createAnalyser();
    microphone = audioContext.createMediaStreamSource(stream);
    volumeBarNode = audioContext.createScriptProcessor(2048, 1, 1);

    analyser.smoothingTimeConstant = 0.8;
    analyser.fftSize = 1024;

    microphone.connect(analyser);
    analyser.connect(volumeBarNode);
    volumeBarNode.connect(audioContext.destination);
    volumeBarNode.onaudioprocess = function() {
            var array = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(array);
            var values = 0;

            var length = array.length;
            for (var i = 0; i < length; i++) {
                values += (array[i]);
            }
            var average = values / length;
            // console.log(Math.round(average));
            colorVolumeBars(average);
    }
}

function colorVolumeBars(vol) {
    let all_pids = $('.volume-bar');
    let amout_of_pids = Math.round(vol/10);
    let elem_range = all_pids.slice(0, amout_of_pids)
    for (var i = 0; i < all_pids.length; i++) {
        all_pids[i].style.backgroundColor="#e6e7e8";
    }
    for (var i = 0; i < elem_range.length; i++) {

        // console.log(elem_range[i]);
        elem_range[i].style.backgroundColor="#69ce2b";
    }
}

function startVR() {
    window.SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    let finalTranscript = '';
    let recognition = new window.SpeechRecognition();
    recognition.interimResults = true;
    recognition.maxAlternatives = 10;
    recognition.continuous = true;
    recognition.onresult = (event) => {
      let interimTranscript = '';
      for (let i = event.resultIndex, len = event.results.length; i < len; i++) {
        let transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }  
    // document.querySelector('body').innerHTML = finalTranscript + '<i style="color:#ddd;">' + interimTranscript + '</>';
    $("#vr-text").html(finalTranscript + '<i style="color:#ddd;">' + interimTranscript + '</>');
    console.log(finalTranscript + '<i style="color:#ddd;">' + interimTranscript + '</>');
    }
    recognition.start();
}

$(function() {
    toastr.options = {
        "maxOpened" : 1,
        "closeButton": true,
        "debug": false,
        "newestOnTop": false,
        "progressBar": false,
        "positionClass": "toast-top-right",
        "preventDuplicates": true,
        "onclick": null,
        "showDuration": "300",
        "hideDuration": "1000",
        "timeOut": "5000",
        "extendedTimeOut": "1000",
        "showEasing": "swing",
        "hideEasing": "linear",
        "showMethod": "fadeIn",
        "hideMethod": "slideUp"
    }
});