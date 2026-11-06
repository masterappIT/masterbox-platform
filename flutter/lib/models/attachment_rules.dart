import 'dart:convert';

/// Which files can be sent to each platform, the same rules the backend applies
/// (backend/lib/storage/attachmentRules.js). The JSON below is a copy of them,
/// and backend/test/attachments.test.js checks it still matches, so the app
/// explains a refusal as soon as a file is picked rather than after uploading.
const attachmentRulesJson = r'''
{
  "maxUploadBytes": 26214400,
  "fileTypes": {
    "image/jpeg": {
      "kind": "image",
      "ext": "jpg",
      "label": "JPG"
    },
    "image/png": {
      "kind": "image",
      "ext": "png",
      "label": "PNG"
    },
    "image/gif": {
      "kind": "image",
      "ext": "gif",
      "label": "GIF"
    },
    "image/webp": {
      "kind": "image",
      "ext": "webp",
      "label": "WebP"
    },
    "video/mp4": {
      "kind": "video",
      "ext": "mp4",
      "label": "MP4"
    },
    "video/quicktime": {
      "kind": "video",
      "ext": "mov",
      "label": "MOV"
    },
    "video/webm": {
      "kind": "video",
      "ext": "webm",
      "label": "WebM"
    },
    "video/3gpp": {
      "kind": "video",
      "ext": "3gp",
      "label": "3GP"
    },
    "audio/mpeg": {
      "kind": "audio",
      "ext": "mp3",
      "label": "MP3"
    },
    "audio/mp4": {
      "kind": "audio",
      "ext": "m4a",
      "label": "M4A"
    },
    "audio/aac": {
      "kind": "audio",
      "ext": "aac",
      "label": "AAC"
    },
    "audio/ogg": {
      "kind": "audio",
      "ext": "ogg",
      "label": "OGG"
    },
    "audio/wav": {
      "kind": "audio",
      "ext": "wav",
      "label": "WAV"
    },
    "audio/amr": {
      "kind": "audio",
      "ext": "amr",
      "label": "AMR"
    },
    "application/pdf": {
      "kind": "file",
      "ext": "pdf",
      "label": "PDF"
    },
    "text/plain": {
      "kind": "file",
      "ext": "txt",
      "label": "TXT"
    },
    "text/csv": {
      "kind": "file",
      "ext": "csv",
      "label": "CSV"
    },
    "application/msword": {
      "kind": "file",
      "ext": "doc",
      "label": "DOC"
    },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      "kind": "file",
      "ext": "docx",
      "label": "DOCX"
    },
    "application/vnd.ms-excel": {
      "kind": "file",
      "ext": "xls",
      "label": "XLS"
    },
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
      "kind": "file",
      "ext": "xlsx",
      "label": "XLSX"
    },
    "application/vnd.ms-powerpoint": {
      "kind": "file",
      "ext": "ppt",
      "label": "PPT"
    },
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
      "kind": "file",
      "ext": "pptx",
      "label": "PPTX"
    }
  },
  "mimeAliases": {
    "image/jpg": "image/jpeg",
    "image/pjpeg": "image/jpeg",
    "audio/mp3": "audio/mpeg",
    "audio/x-m4a": "audio/mp4",
    "audio/m4a": "audio/mp4",
    "audio/x-aac": "audio/aac",
    "audio/x-wav": "audio/wav",
    "audio/wave": "audio/wav",
    "audio/vnd.wave": "audio/wav",
    "audio/opus": "audio/ogg",
    "application/x-pdf": "application/pdf"
  },
  "extensions": {
    "jpg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "webp": "image/webp",
    "mp4": "video/mp4",
    "mov": "video/quicktime",
    "webm": "video/webm",
    "3gp": "video/3gpp",
    "mp3": "audio/mpeg",
    "m4a": "audio/mp4",
    "aac": "audio/aac",
    "ogg": "audio/ogg",
    "wav": "audio/wav",
    "amr": "audio/amr",
    "pdf": "application/pdf",
    "txt": "text/plain",
    "csv": "text/csv",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xls": "application/vnd.ms-excel",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "ppt": "application/vnd.ms-powerpoint",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "jpeg": "image/jpeg",
    "opus": "audio/ogg",
    "3gpp": "video/3gpp"
  },
  "kindLabels": {
    "image": "圖片",
    "video": "影片",
    "audio": "音訊",
    "file": "檔案"
  },
  "platforms": {
    "fb": {
      "name": "Facebook",
      "kinds": {
        "image": {
          "mimes": [
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp"
          ],
          "maxBytes": 26214400,
          "sendType": "image"
        },
        "video": {
          "mimes": [
            "video/mp4",
            "video/quicktime",
            "video/webm",
            "video/3gpp"
          ],
          "maxBytes": 26214400,
          "sendType": "video"
        },
        "audio": {
          "mimes": [
            "audio/mpeg",
            "audio/mp4",
            "audio/aac",
            "audio/ogg",
            "audio/wav",
            "audio/amr"
          ],
          "maxBytes": 26214400,
          "sendType": "audio"
        },
        "file": {
          "mimes": [
            "application/pdf",
            "text/plain",
            "text/csv",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation"
          ],
          "maxBytes": 26214400,
          "sendType": "file"
        }
      }
    },
    "ig": {
      "name": "Instagram",
      "kinds": {
        "image": {
          "mimes": [
            "image/jpeg",
            "image/png"
          ],
          "maxBytes": 8388608,
          "sendType": "image"
        },
        "video": {
          "mimes": [
            "video/mp4",
            "video/quicktime",
            "video/webm"
          ],
          "maxBytes": 26214400,
          "sendType": "video"
        },
        "audio": {
          "mimes": [
            "audio/aac",
            "audio/mp4",
            "audio/wav"
          ],
          "maxBytes": 26214400,
          "sendType": "audio"
        },
        "file": {
          "mimes": [
            "application/pdf"
          ],
          "maxBytes": 26214400,
          "sendType": "file"
        }
      }
    },
    "whatsapp": {
      "name": "WhatsApp",
      "kinds": {
        "image": {
          "mimes": [
            "image/jpeg",
            "image/png"
          ],
          "maxBytes": 5242880,
          "sendType": "image"
        },
        "video": {
          "mimes": [
            "video/mp4",
            "video/3gpp"
          ],
          "maxBytes": 16777216,
          "sendType": "video"
        },
        "audio": {
          "mimes": [
            "audio/aac",
            "audio/amr",
            "audio/mpeg",
            "audio/mp4",
            "audio/ogg"
          ],
          "maxBytes": 16777216,
          "sendType": "audio"
        },
        "file": {
          "mimes": [
            "application/pdf",
            "text/plain",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation"
          ],
          "maxBytes": 26214400,
          "sendType": "document"
        }
      }
    }
  }
}
''';

final Map<String, dynamic> _rules =
    jsonDecode(attachmentRulesJson) as Map<String, dynamic>;

const _mb = 1024 * 1024;

int get maxUploadBytes => _rules['maxUploadBytes'] as int;

/// A stored file type: its MIME type, kind (image, video, audio or file),
/// extension and a short label such as PNG.
class StoredFileType {
  const StoredFileType({
    required this.mime,
    required this.kind,
    required this.ext,
    required this.label,
  });
  final String mime;
  final String kind;
  final String ext;
  final String label;
}

Map<String, dynamic> get _fileTypes =>
    _rules['fileTypes'] as Map<String, dynamic>;

StoredFileType _typeOf(String mime) {
  final info = _fileTypes[mime] as Map<String, dynamic>;
  return StoredFileType(
    mime: mime,
    kind: info['kind'] as String,
    ext: info['ext'] as String,
    label: info['label'] as String,
  );
}

/// The stored type of a file from its MIME type, or from its extension when the
/// MIME type is missing or generic. Null when MasterBox doesn't keep such files.
StoredFileType? resolveFileType(String? mimeType, String? filename) {
  final declared = (mimeType ?? '').split(';').first.trim().toLowerCase();
  final aliases = _rules['mimeAliases'] as Map<String, dynamic>;
  final mime = (aliases[declared] as String?) ?? declared;
  if (_fileTypes.containsKey(mime)) return _typeOf(mime);
  if (declared.isNotEmpty && declared != 'application/octet-stream') {
    return null;
  }
  final ext = RegExp(r'\.([a-z0-9]+)$')
      .firstMatch((filename ?? '').toLowerCase())
      ?.group(1);
  final byExt = (_rules['extensions'] as Map<String, dynamic>)[ext] as String?;
  return byExt == null ? null : _typeOf(byExt);
}

/// Every extension MasterBox keeps, for the file picker.
List<String> get allowedExtensions =>
    (_rules['extensions'] as Map<String, dynamic>).keys.toList();

String kindLabel(String kind) =>
    (_rules['kindLabels'] as Map<String, dynamic>)[kind] as String? ?? '檔案';

/// Whether a platform accepts a file and how to send it.
class AttachmentCheck {
  const AttachmentCheck.ok({
    required String this.mime,
    required String this.kind,
    required String this.sendType,
    required int this.maxBytes,
  }) : reason = null;
  const AttachmentCheck.refused(String this.reason)
    : mime = null,
      kind = null,
      sendType = null,
      maxBytes = null;
  final String? reason;
  final String? mime;
  final String? kind;
  final String? sendType;
  final int? maxBytes;
  bool get ok => reason == null;
}

String _sizeLabel(int bytes) => '${(bytes / _mb).round()}MB';

/// [size] may be unknown until the file has been read.
AttachmentCheck checkAttachment(
  String? platform, {
  String? mime,
  String? filename,
  int? size,
}) {
  final rules = (_rules['platforms'] as Map<String, dynamic>)[platform];
  if (rules is! Map<String, dynamic>) {
    return const AttachmentCheck.refused('這個平台尚未支援傳送附件');
  }
  final type = resolveFileType(mime, filename);
  if (type == null) {
    return const AttachmentCheck.refused(
      '只能傳送圖片、影片、音訊、PDF 或常見文件（Word、Excel、PowerPoint、TXT、CSV）',
    );
  }
  final name = rules['name'] as String;
  final rule =
      (rules['kinds'] as Map<String, dynamic>)[type.kind]
          as Map<String, dynamic>;
  final mimes = (rule['mimes'] as List).cast<String>();
  final label = kindLabel(type.kind);
  if (!mimes.contains(type.mime)) {
    final accepted = mimes.map((m) => _typeOf(m).label).join('、');
    return AttachmentCheck.refused(
      '$name 不接受 ${type.label} $label，$label只能用 $accepted',
    );
  }
  final maxBytes = rule['maxBytes'] as int;
  if (size != null && size > maxBytes) {
    return AttachmentCheck.refused('$name 的$label不能超過 ${_sizeLabel(maxBytes)}');
  }
  if (size != null && size <= 0) {
    return const AttachmentCheck.refused('檔案是空的');
  }
  return AttachmentCheck.ok(
    mime: type.mime,
    kind: type.kind,
    sendType: rule['sendType'] as String,
    maxBytes: maxBytes,
  );
}

/// 1.2MB, 340KB
String formatFileSize(int bytes) => bytes >= _mb
    ? '${(bytes / _mb).toStringAsFixed(1)}MB'
    : '${(bytes / 1024).round().clamp(1, 1023)}KB';
