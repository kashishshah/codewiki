; Functions (top-level and inside impl/trait blocks)
(function_item
  name: (identifier) @fn_name) @function

; Structs
(struct_item
  name: (type_identifier) @struct_name) @struct_def

; Enums
(enum_item
  name: (type_identifier) @enum_name) @enum_def

; Traits
(trait_item
  name: (type_identifier) @trait_name) @trait_def

; Impl blocks
(impl_item
  type: (_) @impl_type) @impl_def

; Use declarations
(use_declaration
  argument: (_) @use_path) @use_decl

; Function calls (simple identifier calls)
(call_expression
  function: (identifier) @call_name) @call_expr

; Method calls
(call_expression
  function: (field_expression
    field: (field_identifier) @method_name)) @method_call

; Module declarations
(mod_item
  name: (identifier) @mod_name) @mod_def

; Constants
(const_item
  name: (identifier) @const_name) @const_def

; Type aliases
(type_item
  name: (type_identifier) @type_name) @type_def
