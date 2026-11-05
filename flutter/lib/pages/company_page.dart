import 'package:flutter/material.dart';

import '../models/app_models.dart';
import '../services/graphql_service.dart';
import '../widgets/common.dart';

// The same rules as the admin site's company form.
final _companyChineseName = RegExp(r'[㐀-鿿]');
final _companyEnglishName = RegExp(r"^[A-Za-z0-9][A-Za-z0-9 .,&'()-]*$");
final _personChineseName = RegExp(r'^[㐀-鿿·・‧]+$');
final _personEnglishName = RegExp(r"^[A-Za-z]+(?:[ .'-]+[A-Za-z]+)*\.?$");
final _digits = RegExp(r'^[0-9]+$');
final _taiwanMobile = RegExp(r'^(\+?886-?|0)?9\d{8}$');
final _hongKongMobile = RegExp(r'^(\+?852[-\s]?)?[456789]\d{3}[-\s]?\d{4}$');
final _chinaMobile = RegExp(r'^((\+|00)86)?(1[3-9]|9[28])\d{9}$');

bool isCompanyPhone(String value) =>
    _taiwanMobile.hasMatch(value) ||
    _hongKongMobile.hasMatch(value) ||
    _chinaMobile.hasMatch(value);

class CompanyPage extends StatefulWidget {
  const CompanyPage({required this.graphQL, super.key});
  final GraphQLService graphQL;

  @override
  State<CompanyPage> createState() => _CompanyPageState();
}

class _CompanyPageState extends State<CompanyPage> {
  final _fields = {
    for (final key in const [
      'chinese_name',
      'english_name',
      'mobile',
      'pin_number',
      'address',
      'cn_name',
      'principal_mobile',
      'first_name',
      'last_name',
    ])
      key: TextEditingController(),
  };
  CompanyInfo? company;
  bool loading = true;
  String? loadError;
  bool saving = false;
  Map<String, String> errors = const {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final field in _fields.values) {
      field.dispose();
    }
    super.dispose();
  }

  Map<String, String> _savedValues(CompanyInfo info) => {
    'chinese_name': info.chineseName,
    'english_name': info.englishName,
    'mobile': info.mobile,
    'pin_number': info.pinNumber,
    'address': info.address,
    'cn_name': info.principalCnName,
    'principal_mobile': info.principalMobile,
    'first_name': info.principalFirstName,
    'last_name': info.principalLastName,
  };

  void _fill(CompanyInfo info) {
    _savedValues(info).forEach((key, value) => _fields[key]!.text = value);
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      loadError = null;
    });
    try {
      final result = await widget.graphQL.fetchCompany();
      if (!mounted) return;
      _fill(result);
      setState(() {
        company = result;
        loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        loadError = '$error';
        loading = false;
      });
    }
  }

  String _value(String key) => _fields[key]!.text.trim();

  Map<String, String> _validate() {
    String invalid(String label) => '請輸入正確的$label';
    return {
      if (!_companyChineseName.hasMatch(_value('chinese_name')))
        'chinese_name': invalid('中文名稱'),
      if (!_companyEnglishName.hasMatch(_value('english_name')))
        'english_name': invalid('英文名稱'),
      if (!isCompanyPhone(_value('mobile'))) 'mobile': invalid('電話號碼'),
      if (!_digits.hasMatch(_value('pin_number')))
        'pin_number': invalid('統一編號'),
      if (!_personChineseName.hasMatch(_value('cn_name')))
        'cn_name': invalid('中文名字'),
      if (!isCompanyPhone(_value('principal_mobile')))
        'principal_mobile': invalid('電話號碼'),
      if (!_personEnglishName.hasMatch(_value('first_name')))
        'first_name': invalid('英文名字'),
      if (!_personEnglishName.hasMatch(_value('last_name')))
        'last_name': invalid('英文姓氏'),
    };
  }

  /// Only what changed is sent, except the principal: saving replaces the whole
  /// principal, so one change has to bring the other fields along.
  Map<String, dynamic> _changes(CompanyInfo saved) {
    final before = _savedValues(saved);
    final changes = <String, dynamic>{
      for (final key in const [
        'chinese_name',
        'english_name',
        'mobile',
        'pin_number',
        'address',
      ])
        if (_value(key) != before[key]) key: _value(key),
    };
    final principalChanged = const [
      'cn_name',
      'principal_mobile',
      'first_name',
      'last_name',
    ].any((key) => _value(key) != before[key]);
    if (principalChanged) {
      changes['principal_info'] = {
        'cn_name': _value('cn_name'),
        'mobile': _value('principal_mobile'),
        'first_name': _value('first_name'),
        'last_name': _value('last_name'),
      };
    }
    return changes;
  }

  Future<void> _save() async {
    final saved = company;
    if (saved == null || saving) return;
    final found = _validate();
    setState(() => errors = found);
    if (found.isNotEmpty) return;
    final changes = _changes(saved);
    final messenger = ScaffoldMessenger.of(context);
    if (changes.isEmpty) {
      messenger.showSnackBar(const SnackBar(content: Text('沒有需要儲存的變更')));
      return;
    }
    setState(() => saving = true);
    try {
      await widget.graphQL.updateCompany(changes);
      final fresh = await widget.graphQL.fetchCompany();
      if (!mounted) return;
      _fill(fresh);
      setState(() => company = fresh);
      messenger.showSnackBar(const SnackBar(content: Text('儲存成功')));
    } catch (error) {
      messenger.showSnackBar(SnackBar(content: Text('無法儲存公司資料：$error')));
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Widget _field(String key, String label, {TextInputType? keyboard}) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: TextField(
      controller: _fields[key],
      keyboardType: keyboard,
      decoration: InputDecoration(labelText: label, errorText: errors[key]),
    ),
  );

  Widget _readOnly(String label, String value) => ListTile(
    contentPadding: EdgeInsets.zero,
    title: Text(label),
    subtitle: Text(value.isEmpty ? '—' : value),
  );

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('公司資料'),
      actions: [
        if (company != null)
          TextButton(
            onPressed: saving ? null : _save,
            child: Text(saving ? '儲存中…' : '儲存'),
          ),
      ],
    ),
    body: _body(),
  );

  Widget _body() {
    if (loading) return const Center(child: CircularProgressIndicator());
    final info = company;
    if (info == null) {
      return Center(
        child: ErrorRetry(message: loadError ?? '找不到公司資料', onRetry: _load),
      );
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const SectionTitle(title: '基本資料'),
        _field('chinese_name', '中文名稱'),
        _field('english_name', '英文名稱'),
        _readOnly('電子信箱', info.email),
        _field('mobile', '電話號碼', keyboard: TextInputType.phone),
        _field('pin_number', '統一編號', keyboard: TextInputType.number),
        _field('address', '地址'),
        const SizedBox(height: 12),
        const SectionTitle(title: '負責人資料'),
        _field('cn_name', '中文名字'),
        _field('principal_mobile', '電話號碼', keyboard: TextInputType.phone),
        _field('first_name', '英文名字'),
        _field('last_name', '英文姓氏'),
        const SizedBox(height: 12),
        const SectionTitle(title: '訂閱方案'),
        _readOnly('目前方案', info.subscriptionName ?? ''),
        _readOnly('方案結束日期', formatDateTime(info.subscriptionEnd)),
      ],
    );
  }
}
