import 'package:flutter/material.dart';
import 'package:livekit_client/livekit_client.dart' as lk;

import 'models/app_models.dart';
import 'services/graphql_service.dart';

/// Minimal LiveKit call surface. The call is created and authenticated by the
/// backend before this page is opened.
class CallPage extends StatefulWidget {
  const CallPage({
    required this.graphQL,
    required this.call,
    required this.token,
    super.key,
  });

  final GraphQLService graphQL;
  final CallSession call;
  final LiveKitToken token;

  @override
  State<CallPage> createState() => _CallPageState();
}

class _CallPageState extends State<CallPage> {
  late final lk.Room _room;
  bool _micEnabled = true;
  bool _cameraEnabled = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _room = lk.Room();
    _room.addListener(_roomChanged);
    _connect();
  }

  Future<void> _connect() async {
    try {
      await _room.connect(widget.token.serverUrl, widget.token.token);
      final local = _room.localParticipant;
      if (local == null) return;
      if (widget.call.kind == 'video') {
        await local.setCameraEnabled(true);
        _cameraEnabled = true;
      }
      await local.setMicrophoneEnabled(true);
      if (mounted) setState(() {});
    } catch (error) {
      if (mounted) setState(() => _error = '$error');
    }
  }

  void _roomChanged() {
    if (mounted) setState(() {});
  }

  Future<void> _toggleMic() async {
    final local = _room.localParticipant;
    if (local == null) return;
    _micEnabled = !_micEnabled;
    await local.setMicrophoneEnabled(_micEnabled);
    if (mounted) setState(() {});
  }

  Future<void> _toggleCamera() async {
    final local = _room.localParticipant;
    if (local == null) return;
    _cameraEnabled = !_cameraEnabled;
    await local.setCameraEnabled(_cameraEnabled);
    if (mounted) setState(() {});
  }

  Future<void> _hangUp() async {
    await _room.disconnect();
    if (mounted) Navigator.of(context).pop();
  }

  Iterable<lk.VideoTrack> get _videoTracks sync* {
    final local = _room.localParticipant;
    if (local != null) {
      for (final publication in local.trackPublications.values) {
        final track = publication.track;
        if (track is lk.VideoTrack) yield track as lk.VideoTrack;
      }
    }
    for (final participant in _room.remoteParticipants.values) {
      for (final publication in participant.trackPublications.values) {
        final track = publication.track;
        if (track is lk.VideoTrack) yield track as lk.VideoTrack;
      }
    }
  }

  @override
  void dispose() {
    _room.removeListener(_roomChanged);
    _room.disconnect();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tracks = _videoTracks.toList();
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.call.kind == 'video' ? '視訊通話' : '語音通話'),
      ),
      body: Column(
        children: [
          if (_error != null)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(_error!, style: const TextStyle(color: Colors.red)),
            ),
          Expanded(
            child: tracks.isEmpty
                ? Center(
                    child: Text(
                      _room.connectionState == lk.ConnectionState.connected
                          ? '等待對方加入…'
                          : '正在連線…',
                    ),
                  )
                : GridView.builder(
                    padding: const EdgeInsets.all(8),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                        ),
                    itemCount: tracks.length,
                    itemBuilder: (_, index) => ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: lk.VideoTrackRenderer(tracks[index]),
                    ),
                  ),
          ),
          SafeArea(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                IconButton(
                  onPressed: _toggleMic,
                  tooltip: '麥克風',
                  icon: Icon(_micEnabled ? Icons.mic : Icons.mic_off),
                ),
                if (widget.call.kind == 'video')
                  IconButton(
                    onPressed: _toggleCamera,
                    tooltip: '相機',
                    icon: Icon(
                      _cameraEnabled ? Icons.videocam : Icons.videocam_off,
                    ),
                  ),
                IconButton(
                  onPressed: _hangUp,
                  tooltip: '掛斷',
                  color: Colors.red,
                  icon: const Icon(Icons.call_end),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
