; Functions
(function_definition
  name: (identifier) @fn_name) @function

; Classes
(class_definition
  name: (identifier) @class_name) @class_def

; Imports
(import_statement
  name: (dotted_name) @import_path) @import_decl

; From imports
(import_from_statement
  module_name: (dotted_name) @import_path) @import_from_decl

; Function calls
(call
  function: (identifier) @call_name) @call_expr

; Method calls
(call
  function: (attribute
    attribute: (identifier) @method_name)) @method_call
