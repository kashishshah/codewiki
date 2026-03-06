; Module definitions
(call
  target: (identifier) @keyword
  (arguments
    (alias) @module_name)
  (#eq? @keyword "defmodule")) @module_def

; Function definitions (def/defp with call-style arguments)
(call
  target: (identifier) @keyword
  (arguments
    (call
      target: (identifier) @fn_name))
  (#any-of? @keyword "def" "defp")) @function_def

; Function definitions (def/defp with simple identifier — no-arg functions)
(call
  target: (identifier) @keyword
  (arguments
    (identifier) @fn_name_simple)
  (#any-of? @keyword "def" "defp")) @function_def_simple

; Protocol definitions
(call
  target: (identifier) @keyword
  (arguments
    (alias) @protocol_name)
  (#eq? @keyword "defprotocol")) @protocol_def

; Implementation blocks
(call
  target: (identifier) @keyword
  (arguments
    (alias) @impl_name)
  (#eq? @keyword "defimpl")) @impl_def

; Imports (use/import/alias)
(call
  target: (identifier) @keyword
  (arguments
    (alias) @import_path)
  (#any-of? @keyword "use" "import" "alias")) @import_decl

; Function calls (simple identifier)
(call
  target: (identifier) @call_name) @call_expr
