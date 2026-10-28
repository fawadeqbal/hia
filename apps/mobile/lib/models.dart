double _n(dynamic v) => v == null ? 0 : (v as num).toDouble();

class ProductCard {
  ProductCard(this.j);
  final Map<String, dynamic> j;
  String get id => j['id'];
  String get name => j['name'];
  String get slug => j['slug'];
  String? get imageUrl => j['imageUrl'];
  double get price => _n(j['price']);
  double? get compareAt => j['compareAtPrice'] == null ? null : _n(j['compareAtPrice']);
  String get currency => j['currency'] ?? 'USD';
  double get rating => _n(j['ratingAverage']);
  int get ratingCount => (j['ratingCount'] ?? 0) as int;
  bool get inStock => j['inStock'] == true;
  bool get hasOptions => j['hasOptions'] == true;
  String? get brand => j['brandName'];
  int get discount => compareAt != null && compareAt! > price ? ((1 - price / compareAt!) * 100).round() : 0;
}

class Category {
  Category(this.j);
  final Map<String, dynamic> j;
  String get id => j['id'];
  String get name => j['name'];
  String get slug => j['slug'];
  String? get imageUrl => j['imageUrl'];
  List<Category> get children => ((j['children'] ?? []) as List).map((c) => Category(Map<String, dynamic>.from(c))).toList();
}

class Variant {
  Variant(this.j);
  final Map<String, dynamic> j;
  String get id => j['id'];
  double get price => _n(j['price']);
  double? get compareAt => j['compareAtPrice'] == null ? null : _n(j['compareAtPrice']);
  int get available => (j['available'] ?? 0) as int;
  Map<String, String> get values => Map<String, String>.from(j['values'] ?? {});
}

class ProductDetail {
  ProductDetail(this.j);
  final Map<String, dynamic> j;
  String get id => j['id'];
  String get name => j['name'];
  String? get description => j['description'];
  String get currency => j['currency'] ?? 'USD';
  double get rating => _n(j['ratingAverage']);
  int get ratingCount => (j['ratingCount'] ?? 0) as int;
  String? get brand => (j['brand'] as Map?)?['name'];
  String get vendor => (j['vendor'] as Map)['name'];
  List<String> get images => ((j['images'] ?? []) as List).map((i) => i['url'] as String).toList();
  List<Map<String, dynamic>> get options => ((j['options'] ?? []) as List).map((o) => Map<String, dynamic>.from(o)).toList();
  List<Variant> get variants => ((j['variants'] ?? []) as List).map((v) => Variant(Map<String, dynamic>.from(v))).toList();
  String get defaultVariantId => j['defaultVariantId'];
}
