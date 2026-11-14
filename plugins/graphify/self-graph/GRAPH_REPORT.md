# Graph Report - graphify  (2026-11-12)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 4335 nodes · 9913 edges · 194 communities (173 shown, 21 thin omitted)
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 1289 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `52cb2821`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- Community 107
- Community 108
- Community 109
- Community 110
- Community 111
- Community 112
- Community 113
- Community 114
- Community 115
- Community 116
- Community 117
- Community 119
- Community 120
- Community 121
- Community 122
- Community 123
- Community 124
- Community 125
- Community 126
- Community 127
- Community 128
- Community 129
- Community 130
- Community 131
- Community 132
- Community 133
- Community 134
- Community 135
- Community 136
- Community 137
- Community 138
- Community 139
- Community 140
- Community 141
- Community 142
- Community 143
- Community 144
- Community 145
- Community 146
- Community 147
- Community 148
- Community 149
- Community 150
- Community 151
- Community 152
- Community 153
- Community 154
- Community 155
- Community 156
- Community 157
- Community 158
- Community 159
- Community 160
- Community 161
- Community 162
- Community 163
- Community 164
- Community 165
- Community 166
- Community 167
- Community 168
- Community 169
- Community 170
- Community 171
- Community 172
- Community 173
- Community 174
- Community 175
- Community 176
- Community 177
- Community 178
- Community 179
- Community 180
- Community 181
- Community 182
- Community 183
- Community 184
- Community 185
- Community 186
- Community 187
- Community 188
- Community 190
- Community 191

## God Nodes (most connected - your core abstractions)
1. `_read_text()` - 270 edges
2. `_make_id()` - 157 edges
3. `walk()` - 98 edges
4. `_extract_generic()` - 91 edges
5. `dispatch_command()` - 83 edges
6. `extract()` - 79 edges
7. `_rebuild_code()` - 72 edges
8. `_file_stem()` - 58 edges
9. `walk_calls()` - 47 edges
10. `_make_id()` - 45 edges

## Surprising Connections (you probably didn't know these)
- `_walk_scoped()` --calls--> `_read_text()`  [INFERRED]
  extract.py → extractors/base.py
- `link_cross_repo_member_calls()` --uses--> `CsharpNameResolver`  [INFERRED]
  cross_repo_calls.py → extractors/csharp.py
- `extract()` --uses--> `CsharpNameResolver`  [INFERRED]
  extract.py → extractors/csharp.py
- `_resolve_csharp_extension_calls()` --uses--> `CsharpNameResolver`  [INFERRED]
  extract.py → extractors/csharp.py
- `_resolve_csharp_member_calls()` --uses--> `CsharpNameResolver`  [INFERRED]
  extract.py → extractors/csharp.py

## Import Cycles
- None detected.

## Communities (194 total, 21 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (70): _repoint_python_package_imports(), _repoint_python_sibling_imports(), _augment_symbol_resolution_edges(), _cached_realpath(), _cached_source_key(), _collect_python_symbol_resolution_facts(), _contained_in_package(), _cpp_exact_includes() (+62 more)

### Community 1 - "Community 1"
Cohesion: 0.03
Nodes (34): extract_xaml(), _import_python(), _kotlin_package_index(), _missing_relative_module_name(), _namespace_src_module_parts(), _python_import_bindings(), _python_under_type_checking(), _resolve_csharp_qualified_calls() (+26 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (39): _agents_platform_install(), _amp_install(), _amp_legacy_cleanup(), _antigravity_uninstall(), _claude_global_registration(), claude_uninstall(), _codebuddy_global_registration(), codebuddy_install() (+31 more)

### Community 3 - "Community 3"
Cohesion: 0.04
Nodes (36): _bash_commands(), _bash_invokes_search(), _bash_read_target(), _clone_repo(), _enforce_graph_size_cap_or_exit(), _gc_hook_session_markers(), _graph_hint(), _graph_root_for() (+28 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (59): _default_graph_path(), attach_graph_impact(), bold(), build_community_labels(), _c(), _ci_icon(), _classify(), cmd_prs() (+51 more)

### Community 5 - "Community 5"
Cohesion: 0.03
Nodes (38): _default_max_workers(), _emit_ejs_include(), extract_c(), extract_csharp(), extract_groovy(), extract_java(), extract_kotlin(), extract_lua() (+30 more)

### Community 6 - "Community 6"
Cohesion: 0.03
Nodes (43): _cpp_call_name(), _cpp_receiver_chain(), _csharp_argc(), _csharp_bare_call_name(), _csharp_creation_argc(), _csharp_member_call_parts(), _csharp_pre_scan_interfaces(), _csharp_receiver_is_declared() (+35 more)

### Community 7 - "Community 7"
Cohesion: 0.05
Nodes (36): _agents_install(), _agents_platform_uninstall(), _agents_uninstall(), _amp_uninstall(), _claude_pretooluse_hooks(), _claude_sessionstart_hooks(), _cursor_uninstall(), _drop_opencode_config_entry() (+28 more)

### Community 8 - "Community 8"
Cohesion: 0.04
Nodes (30): _attach_cpp_out_of_line_methods(), _canonicalize_csharp_namespace_nodes(), _check_tree_sitter_version(), _csharp_collapse_overloads(), _csharp_overload_index(), _drop_shadowed_csharp_partial_bases(), extract(), _decompose() (+22 more)

### Community 9 - "Community 9"
Cohesion: 0.05
Nodes (37): _import_csharp(), _import_kotlin(), _csharp_method_signature(), add_edge(), add_node(), csharp_add_constructor(), decl_node(), ensure_named_node() (+29 more)

### Community 10 - "Community 10"
Cohesion: 0.06
Nodes (28): _compute_idf(), _find_node(), _find_node_tiers(), _flatten_attr_text(), _get_trigram_index(), _is_name_segment(), _label_has_literal_exact_match(), _name_key() (+20 more)

### Community 11 - "Community 11"
Cohesion: 0.04
Nodes (26): _astro_mask_non_script(), _ejs_mask_non_script(), _emit_rescued_import(), extract_astro(), extract_ejs(), extract_js(), extract_php(), extract_svelte() (+18 more)

### Community 12 - "Community 12"
Cohesion: 0.07
Nodes (41): _c3_linearization(), linearize(), _callable_signature(), _callee_text(), _collision_groups(), _element_type(), extract_solidity(), add_edge() (+33 more)

### Community 13 - "Community 13"
Cohesion: 0.05
Nodes (35): _get_c_func_name(), _resolve_name(), _read_text(), _cpp_class_lookup_facts(), scala_base_name(), _java_bound_names(), _java_declarator_names(), _java_lambda_parameters() (+27 more)

### Community 14 - "Community 14"
Cohesion: 0.06
Nodes (35): _semantic_reference_edge(), _source_location(), extract_objc(), add_edge(), add_node(), _collect_instance_variables(), _emit_enum(), ensure_named_node() (+27 more)

### Community 15 - "Community 15"
Cohesion: 0.05
Nodes (29): _cpp_plain_template_parameters(), _cpp_primary_template_function_name(), _cpp_zero_arg_member_signature(), _csharp_classify_base(), _csharp_extra_walk(), _csharp_namespace_id(), _csharp_namespace_name(), _csharp_pre_scan_name_collisions() (+21 more)

### Community 16 - "Community 16"
Cohesion: 0.05
Nodes (27): backend_detection_env_vars(), backend_disabled_by_env(), _backend_env_keys(), _backend_supports_vision(), _claude_cli_available(), _community_label_lines(), _custom_providers_path(), detect_backend() (+19 more)

### Community 17 - "Community 17"
Cohesion: 0.05
Nodes (23): _adopt_pre_manifest_notes(), attach_hyperedges(), _cap_filename(), _cypher_escape(), _cypher_label(), _dedup_node_filenames(), existing_graph_node_count(), _is_graphify_note() (+15 more)

### Community 18 - "Community 18"
Cohesion: 0.07
Nodes (25): _builtin_hooks_dir(), _comparable_block(), _detached_launch(), _git_root(), _has_merge_attr(), _hooks_dir(), _hooks_path_allowed(), install() (+17 more)

### Community 19 - "Community 19"
Cohesion: 0.05
Nodes (26): extract_csproj(), _extract_js_rationale(), _add_doc_ref(), _add_rationale(), extract_lazarus_package(), extract_python(), _extract_python_rationale(), _add_rationale() (+18 more)

### Community 20 - "Community 20"
Cohesion: 0.06
Nodes (26): _build_state_matches(), _canonical_graph_for_compare(), _canonical_topology_for_compare(), _changed_path_candidates(), _drain_pending(), _drain_pending_full(), _drain_pending_incremental(), _git_head() (+18 more)

### Community 21 - "Community 21"
Cohesion: 0.07
Nodes (25): _drop_previous_output(), _index_declarations(), _index_members(), _key(), link_cross_repo_member_calls(), _member_keys(), _member_relations(), _objc_union_definition() (+17 more)

### Community 22 - "Community 22"
Cohesion: 0.08
Nodes (21): _cross_community_surprises(), _cross_file_surprises(), _cross_language(), _file_category(), find_import_cycles(), god_nodes(), graph_diff(), _is_concept_node() (+13 more)

### Community 23 - "Community 23"
Cohesion: 0.08
Nodes (24): detect(), _ignored_for_scan(), _find_vcs_root(), _git_global_excludes(), _git_info_exclude(), _git_tracked_path_keys(), _has_vcs_marker(), ignored_predicate() (+16 more)

### Community 24 - "Community 24"
Cohesion: 0.08
Nodes (32): _import_lua(), _make_id(), _java_extra_walk(), _kotlin_extra_walk(), _php_extra_walk(), _ts_extra_walk(), _scan_type_names(), extract_julia() (+24 more)

### Community 25 - "Community 25"
Cohesion: 0.06
Nodes (21): _anthropic_response_text(), _azure_client(), _backend_pkg_hint(), _call_azure(), _call_claude(), _call_llm(), _call_ollama_native(), _call_openai_compat() (+13 more)

### Community 26 - "Community 26"
Cohesion: 0.06
Nodes (29): _augment_js_reexport_edges(), _NamespaceExportFact, _StarExportFact, _SymbolAliasFact, _SymbolDeclarationFact, _SymbolExportFact, _SymbolImportFact, _SymbolResolutionFacts (+21 more)

### Community 27 - "Community 27"
Cohesion: 0.09
Nodes (18): _bash_make_id(), build_label_index(), build_python_symbol_index(), existing_edge_pairs(), _file_node_id_for_path(), find_unique_python_symbol(), ImportedSymbol, iter_raw_calls() (+10 more)

### Community 28 - "Community 28"
Cohesion: 0.06
Nodes (19): dedupe_edges(), dedupe_nodes(), deduplicate_by_label(), disambiguate_file_labels_in_nodes(), _disambiguate_file_node_labels(), distinct_repo_tags(), edge_evidence(), _evidence() (+11 more)

### Community 29 - "Community 29"
Cohesion: 0.08
Nodes (16): _kiro_uninstall(), _platform_skill_destination(), _print_banner(), _warn_shadowing_agents_skill(), _check_skill_version(), __getattr__(), main(), _opencode_loads_current_plugin() (+8 more)

### Community 30 - "Community 30"
Cohesion: 0.10
Nodes (19): _clean_ident(), _clean_part(), extract_sql(), _add_edge(), _add_node(), _collect_defined_names(), _obj_name(), _read() (+11 more)

### Community 31 - "Community 31"
Cohesion: 0.07
Nodes (18): _is_top_level_function_definition(), _lang_family(), _lang_is_case_insensitive(), _merge_swift_extensions(), _node_label_key(), _park_unresolved_member_call(), _resolve_go_member_calls(), _inherited_method() (+10 more)

### Community 32 - "Community 32"
Cohesion: 0.07
Nodes (17): _import_js(), extract_apex(), extract_delphi_form(), extract_lazarus_form(), _apply_symbol_resolution_facts(), add_edge(), _collision_aware(), ensure_symbol_node() (+9 more)

### Community 33 - "Community 33"
Cohesion: 0.09
Nodes (17): _build_link_index(), _code_span_mention(), extract_markdown(), add_edge(), add_link(), add_mention(), _is_code_file_link(), _fence_closes() (+9 more)

### Community 34 - "Community 34"
Cohesion: 0.12
Nodes (21): extract_go(), add_edge(), add_node(), emit_go_method_refs(), emit_go_package_var_type_refs(), ensure_named_node(), _plain_symbol_nid(), _receiver_type_of() (+13 more)

### Community 35 - "Community 35"
Cohesion: 0.10
Nodes (15): _auto_follow_symlinks(), convert_office_file(), count_words(), _wc(), _docx_blocks(), _docx_cell_markdown(), _docx_children(), _docx_inside() (+7 more)

### Community 36 - "Community 36"
Cohesion: 0.10
Nodes (18): _always_on(), _antigravity_finalize(), _antigravity_install(), _canonical_platform(), claude_install(), _cursor_install(), _devin_rules_install(), dispatch_install_cli() (+10 more)

### Community 37 - "Community 37"
Cohesion: 0.09
Nodes (19): _ambiguity_message(), _bfs(), _complete_induced_edges(), _dfs(), _display_graph_path(), _filter_graph_by_context(), find_node_ambiguity(), _infer_context_filters() (+11 more)

### Community 38 - "Community 38"
Cohesion: 0.10
Nodes (16): _checkout_prefix(), _collapse_manifest_duplicates(), load_manifest(), _looks_absolute(), _manifest_storage_anchor(), _nfc(), _normpath_own_flavor(), _previous_checkout_absolute_keys() (+8 more)

### Community 39 - "Community 39"
Cohesion: 0.13
Nodes (17): _abs_identity(), build(), build_merge(), _explained(), _kept(), _prune_match(), _replaced_on_purpose(), _build_prune_sets() (+9 more)

### Community 40 - "Community 40"
Cohesion: 0.11
Nodes (17): extract_rust(), add_edge(), add_node(), emit_param_return_refs(), ensure_named_node(), file_item_nid(), _scan_local_types(), walk() (+9 more)

### Community 41 - "Community 41"
Cohesion: 0.12
Nodes (15): FileSlice, read_slice_text(), unit_path(), _bind_node_evidence(), _build_image_refs(), _dispatched_source_text(), _estimate_file_tokens(), extract_files_direct() (+7 more)

### Community 42 - "Community 42"
Cohesion: 0.12
Nodes (15): _cited_file_suffix(), _evidence(), _is_file_node(), _is_pascal_case_export_language(), _is_prose_like_label(), _markdown_raw_calls(), _match_cited_file(), _match_cited_file_any_form() (+7 more)

### Community 43 - "Community 43"
Cohesion: 0.12
Nodes (17): activate_language_overrides(), _active(), cache_salt(), get_language_overrides(), load_graphifyrc(), _normalise_ext(), parse_language_value(), set_language_overrides() (+9 more)

### Community 44 - "Community 44"
Cohesion: 0.12
Nodes (16): _collision_rank(), _defines_id(), _disambiguate_defining_collisions(), key(), _extension_qualified_id(), _full_stem(), _id_prefixes(), _mentions() (+8 more)

### Community 45 - "Community 45"
Cohesion: 0.14
Nodes (14): _detect_url_type(), _download_binary(), _fetch_arxiv(), _fetch_html(), _fetch_tweet(), _fetch_webpage(), _free_capture_path(), _host_is() (+6 more)

### Community 46 - "Community 46"
Cohesion: 0.12
Nodes (10): _alias_index(), finalize_raw_graph_endpoints(), graph_has_legacy_ids(), _old_file_stems(), _semantic_id_remap(), decl_salt(), DeclIdRegistry, make_id() (+2 more)

### Community 47 - "Community 47"
Cohesion: 0.08
Nodes (9): dispatch_command(), _print_cloud_cta(), _reenter_main(), _StageTimer, consumed(), consumed_graph_rows(), read_graph_json(), _is_ambiguity_refusal() (+1 more)

### Community 48 - "Community 48"
Cohesion: 0.20
Nodes (21): extract_commonlisp(), add_edge(), add_import_stub(), add_node(), _cl_id(), _collect_def_body(), ensure_class_ref(), _extract_def_name() (+13 more)

### Community 49 - "Community 49"
Cohesion: 0.16
Nodes (15): affected_nodes(), AffectedHit, _as_repo_relative(), _bare_name(), format_affected(), _format_location(), load_graph(), _node_label() (+7 more)

### Community 50 - "Community 50"
Cohesion: 0.10
Nodes (13): build_community_index(), classify_edges(), _community_text(), derive_sections_from_communities(), detect_lang(), generate_header(), generate_nav(), _keyword_score() (+5 more)

### Community 51 - "Community 51"
Cohesion: 0.10
Nodes (12): build_section_node_map(), CallflowOptions, first_list(), html_comment_text(), infer_project_name(), load_graph(), load_labels(), load_report() (+4 more)

### Community 52 - "Community 52"
Cohesion: 0.13
Nodes (11): cluster(), cohesion_score(), community_member_sigs(), label_communities_by_hub(), label_still_applies(), _native_leiden(), _partition(), remap_communities_to_previous() (+3 more)

### Community 53 - "Community 53"
Cohesion: 0.18
Nodes (18): extract_r(), add_class(), add_class_members(), add_edge(), add_node(), argument_value(), binding(), binding_id() (+10 more)

### Community 54 - "Community 54"
Cohesion: 0.11
Nodes (12): _coerce_deps(), extract_package_manifest(), is_package_manifest_path(), _load_toml_module(), _parse_apm(), _parse_apm_fallback(), _parse_cargo(), _parse_gomod() (+4 more)

### Community 55 - "Community 55"
Cohesion: 0.12
Nodes (10): _best_cut(), bisect_slice(), expand_oversized_files(), is_complete_slice_coverage(), is_splittable_text(), make_full_slice(), _pdf_text(), slice_boundaries() (+2 more)

### Community 56 - "Community 56"
Cohesion: 0.14
Nodes (11): _build_scip_metadata(), _coerce_str(), _emit_relationships(), _emit_symbol_node(), _first_occurrence_line(), ingest_scip_json(), _is_true(), _make_scip_node_id() (+3 more)

### Community 57 - "Community 57"
Cohesion: 0.09
Nodes (11): edge_datas(), _confidence_tag(), _path_confidence_key(), _path_confidence_line(), _path_hop_datas(), _path_hub_penalty(), _path_search_graph(), _path_weakest() (+3 more)

### Community 58 - "Community 58"
Cohesion: 0.12
Nodes (13): _csharp_attribute_names(), _csharp_collect_type_refs(), _csharp_deferred_call(), _csharp_element_type_name(), _csharp_loop_element_types(), _csharp_loop_source(), _csharp_method_receiver_types(), bind() (+5 more)

### Community 59 - "Community 59"
Cohesion: 0.10
Nodes (12): _js_collect_pattern_idents(), _js_direct_lexical_names(), _js_extra_walk(), _js_find_exported_objects(), _js_local_bound_names(), walk(), _js_member_assignment_target(), _js_module_bound_names() (+4 more)

### Community 60 - "Community 60"
Cohesion: 0.13
Nodes (16): extract_powershell(), add_edge(), add_node(), ensure_named_node(), _find_script_block_body(), extract_powershell_manifest(), add_import_edge(), walk_manifest() (+8 more)

### Community 61 - "Community 61"
Cohesion: 0.16
Nodes (20): extract_robot(), add_call_edges(), add_edge(), add_node(), kw_targets(), visit_Keyword(), visit_KeywordCall(), visit_LibraryImport() (+12 more)

### Community 62 - "Community 62"
Cohesion: 0.09
Nodes (14): _batch_needs_llm_flag(), _batch_triggers_rebuild(), check_update(), _graphify_root_marker_value(), _has_non_code(), _is_relative_to(), _notify_only(), _queue_pending() (+6 more)

### Community 63 - "Community 63"
Cohesion: 0.11
Nodes (12): _stale_graph_sources(), _in_seen(), _provably_excluded(), disambiguate_ambiguous_candidates(), _is_test_path(), nfc(), _out_from_env(), _parent_parts() (+4 more)

### Community 64 - "Community 64"
Cohesion: 0.09
Nodes (10): _content_token_swap(), _is_code(), _lifecycle_penalty(), _make_minhash(), _merge_missing_attributes(), _reads_as_file_entity(), _remap_hyperedge_members(), _same_source_entity() (+2 more)

### Community 65 - "Community 65"
Cohesion: 0.09
Nodes (13): _c_collect_type_refs(), _cpp_class_fields(), _cpp_collect_type_refs(), _cpp_declarator_name(), _cpp_declared_receiver_type(), _cpp_field_types(), _cpp_local_binding_ranges(), _cpp_local_var_types() (+5 more)

### Community 66 - "Community 66"
Cohesion: 0.10
Nodes (11): _alias_lang_compatible(), build_from_json(), _resolve_endpoint(), edge_data(), _fold_confidence(), _fold_edge_aliases(), _fold_node_aliases(), _mint_external_stub() (+3 more)

### Community 67 - "Community 67"
Cohesion: 0.12
Nodes (11): generate_overview_graph(), generate_section_flowchart(), group_nodes_by_file(), mermaid_class_defs(), mermaid_init(), mermaid_section_id(), node_label(), node_mermaid_id() (+3 more)

### Community 68 - "Community 68"
Cohesion: 0.16
Nodes (11): _code_lines(), extract_cobol(), _mask_strings(), _starts_inside_string(), _augment_systemverilog_semantics(), add_edge(), add_node(), ensure_type() (+3 more)

### Community 69 - "Community 69"
Cohesion: 0.10
Nodes (12): _dynamic_import_js(), _find_require_call(), _js_external_import_names(), _clause_names(), walk(), _js_import_binds_external(), _js_import_is_type_only(), _js_require_resolves_locally() (+4 more)

### Community 70 - "Community 70"
Cohesion: 0.10
Nodes (11): _augment_cpp_string_tests(), _blank_keeping_newlines(), _cpp_conditional_groups(), _cpp_conditional_tokens(), _cpp_expression_conditional_groups(), extract_cpp(), _normalize_cpp_cli(), _normalize_cpp_export_macros() (+3 more)

### Community 71 - "Community 71"
Cohesion: 0.18
Nodes (14): _bash_assignment_base(), _bash_source_suffix(), extract_bash(), add_edge(), add_node(), _bash_call_in_command_allowed(), _bash_func_name(), is_inside_expansion() (+6 more)

### Community 72 - "Community 72"
Cohesion: 0.16
Nodes (13): _is_file_node_label(), _key(), _method_name(), resolve_ruby_member_calls(), _class_by_const_path(), _has_external_method_owner(), _inherited_method(), _promote_inferred() (+5 more)

### Community 73 - "Community 73"
Cohesion: 0.17
Nodes (10): _construct_permissive(), _doc_label(), extract_yaml(), add_edge(), add_node(), _top_keys(), walk(), _is_config_yaml() (+2 more)

### Community 74 - "Community 74"
Cohesion: 0.15
Nodes (5): _ip_is_blocked(), _NoFileRedirectHandler, _resolve_and_validate(), _SSRFGuardedHTTPConnection, validate_url()

### Community 75 - "Community 75"
Cohesion: 0.21
Nodes (12): _build_probe_graph(), CapabilityCheck, _check(), MultigraphCapabilityResult, _probe_duplicate_key_overwrite_semantics(), _probe_keyed_parallel_edges(), probe_multigraph_capabilities(), _probe_node_link_round_trip() (+4 more)

### Community 76 - "Community 76"
Cohesion: 0.19
Nodes (11): prune_repo_from_graph(), _file_hash(), global_add(), global_list(), global_path(), global_remove(), _load_global_graph(), _load_manifest() (+3 more)

### Community 77 - "Community 77"
Cohesion: 0.13
Nodes (10): edge_score(), node_degree_scores(), node_importance(), node_kind(), preferred_edges(), select_diagram_nodes(), add_node(), fallback_key() (+2 more)

### Community 78 - "Community 78"
Cohesion: 0.16
Nodes (8): aggregate_lessons(), _decay(), _dedupe_by_question(), _doc_community(), _empty_bucket(), _finalize_sources(), _parse_dt(), _record_node()

### Community 79 - "Community 79"
Cohesion: 0.15
Nodes (8): _is_go_interface(), resolve_go_interface_dispatch(), required(), declared_in(), _dispatch_confidence(), method_label(), _overload_pairs(), resolve_interface_dispatch()

### Community 80 - "Community 80"
Cohesion: 0.18
Nodes (9): convert_google_workspace_file(), _extract_file_id_from_url(), _extract_resource_key(), google_workspace_enabled(), read_google_shortcut(), _run_gws_export(), _safe_yaml_str(), _sidecar_path() (+1 more)

### Community 81 - "Community 81"
Cohesion: 0.13
Nodes (9): _anthropic_content(), _bedrock_content(), _bedrock_response_text(), _call_bedrock(), _image_notes(), _ImageRef, _openai_content(), _strip_pixels() (+1 more)

### Community 82 - "Community 82"
Cohesion: 0.13
Nodes (5): _lsh_integrate(), _mh_coeffs(), MinHash, MinHashLSH, _optimal_lsh_params()

### Community 83 - "Community 83"
Cohesion: 0.21
Nodes (13): extract_elixir(), add_edge(), add_node(), _call_scope_for(), _expand_module(), _get_alias_modules(), _get_alias_text(), _get_do_keyword_body() (+5 more)

### Community 84 - "Community 84"
Cohesion: 0.11
Nodes (9): _cpp_alias_names(), _cpp_declarator_type_name(), _cpp_extra_walk(), _cpp_is_header_guard(), _cpp_lookup_scope(), _cpp_member_record(), _cpp_qualified_name(), _cpp_resolution_facts() (+1 more)

### Community 85 - "Community 85"
Cohesion: 0.18
Nodes (7): _add_edge(), _add_node(), _detect_package_from_args(), _emit_server(), extract_mcp_config(), is_mcp_config_path(), _strip_version()

### Community 86 - "Community 86"
Cohesion: 0.19
Nodes (8): _community_article(), _cross_community_links(), _god_node_article(), _index_md(), _md_link(), _md_link_to(), _safe_filename(), to_wiki()

### Community 87 - "Community 87"
Cohesion: 0.13
Nodes (8): _body_content(), cached_files(), clear_cache(), _mtime_granularity_ns(), _present_target_files(), prune_semantic_cache(), _stat_sig_fresh(), _target_file_present()

### Community 88 - "Community 88"
Cohesion: 0.12
Nodes (10): _dedup_shrink_allowance(), has_parallel_links(), take_dedup_remap(), take_shrink_accounting(), _git_head(), _graphify_version(), _strip_diacritics(), to_json() (+2 more)

### Community 89 - "Community 89"
Cohesion: 0.18
Nodes (8): qualify_csharp_method_labels_in_nodes(), bare_csharp_method_label(), bare_csharp_method_labels_in_nodes(), _build_csharp_type_def_index(), csharp_method_label_reassignments(), _is_cs_file(), _is_plain_csharp_name(), _resolve_cross_file_csharp_imports()

### Community 91 - "Community 91"
Cohesion: 0.15
Nodes (11): RFC-8089, graphify(), HostAPI, HostContext, HostEvent, installedCommand(), isRemote(), localPath() (+3 more)

### Community 92 - "Community 92"
Cohesion: 0.15
Nodes (10): _blank_csharp_preprocessor(), blank(), close(), keep(), _csharp_branch_balanced(), _csharp_branch_member_sigs(), _csharp_broken_escape_offsets(), _csharp_string_opener() (+2 more)

### Community 93 - "Community 93"
Cohesion: 0.22
Nodes (11): _cpp_preprocess(), extract_fortran(), add_edge(), add_node(), emit_signature_refs(), ensure_named_node(), _fortran_name(), _type_bound_impl_name() (+3 more)

### Community 94 - "Community 94"
Cohesion: 0.21
Nodes (9): _attach_files(), _ensure_dir(), build_tree(), _finalise(), _common_root(), emit_html(), _make_truncation_leaf(), _repo_groups() (+1 more)

### Community 95 - "Community 95"
Cohesion: 0.17
Nodes (11): sanitize_label(), _tool_get_community(), _tool_get_neighbors(), _tool_get_node(), _community_header(), _cut_lines_to_budget(), _near_miss_message(), _neighbor_lines() (+3 more)

### Community 96 - "Community 96"
Cohesion: 0.21
Nodes (9): cached_word_count(), _ensure_stat_index(), file_hash(), _flush_stat_index(), _normalize_path(), _stat_entry_for(), _stat_index_file(), _stat_key_to_absolute() (+1 more)

### Community 97 - "Community 97"
Cohesion: 0.17
Nodes (8): _describe_node(), format_node_refs(), generate_call_table_rows(), generate_section_cards(), pick_text(), _report_highlights(), safe_file_path(), _suggest_tag()

### Community 98 - "Community 98"
Cohesion: 0.20
Nodes (10): _crossfile_fileanchored_blocked(), deduplicate_entities(), _crossfile_join(), _crossfile_union(), _get_prot(), _union_with_prot(), _is_variant_pair(), _llm_tiebreak() (+2 more)

### Community 99 - "Community 99"
Cohesion: 0.13
Nodes (8): classify_file(), _env_command_args(), FileType, _looks_like_paper(), _shebang_file_type(), _shebang_interpreter(), _split_env_s(), _strip_interpreter_version()

### Community 101 - "Community 101"
Cohesion: 0.12
Nodes (6): _build_http_app(), _filter_blank_stdin(), _main(), _MCPASGIApp, serve(), serve_http()

### Community 102 - "Community 102"
Cohesion: 0.15
Nodes (8): _chunk_partial_files(), _run_one(), _extract_with_adaptive_retry(), _merge_two(), _looks_like_context_exceeded(), _looks_like_timeout(), _mark_partial(), _merged_partial_files()

### Community 103 - "Community 103"
Cohesion: 0.18
Nodes (6): _estimate_tokens(), _hr(), print_benchmark(), _query_subgraph_tokens(), run_benchmark(), _safe()

### Community 104 - "Community 104"
Cohesion: 0.19
Nodes (7): _normalize_hyperedge_members(), _append_rationale_attr(), _is_sentence_like_rationale_label(), load_validated_semantic_fragment(), sanitize_semantic_fragment(), validate_semantic_fragment(), _validate_semantic_id()

### Community 105 - "Community 105"
Cohesion: 0.24
Nodes (8): _discover_root_manifest(), introspect_cargo(), _load_toml(), _member_manifest_paths(), package_name(), crate_of(), in_stub_crate(), keep()

### Community 106 - "Community 106"
Cohesion: 0.17
Nodes (10): _python_class_ref(), _python_collect_assignment_targets(), _python_local_class_bindings(), bind(), poison(), poison_identifiers(), visit(), _python_module_bound_names() (+2 more)

### Community 107 - "Community 107"
Cohesion: 0.16
Nodes (5): prepare_terraform(), _redact_value(), refresh_terraform_paths(), resolve_terraform_modules(), _scope_id()

### Community 108 - "Community 108"
Cohesion: 0.28
Nodes (13): extract_terraform(), _add_edge(), _add_node(), _block_parts(), _clean_val_str(), _collect_direct_attributes(), _collect_refs(), _head_and_attrs() (+5 more)

### Community 109 - "Community 109"
Cohesion: 0.17
Nodes (7): _code_fingerprint(), _content_hash(), _is_stale(), lessons_fresh(), _load_known_nodes(), _load_node_community(), _resolve_source_path()

### Community 110 - "Community 110"
Cohesion: 0.17
Nodes (9): _enclosed_by(), _members_named(), _membership_neighbors(), _named_nodes(), _names_source_file(), fold(), _qualified_member_owners(), _resolve_qualified_member() (+1 more)

### Community 111 - "Community 111"
Cohesion: 0.21
Nodes (8): build_whisper_prompt(), download_audio(), _get_whisper(), _get_yt_dlp(), is_url(), _model_name(), transcribe(), transcribe_all()

### Community 112 - "Community 112"
Cohesion: 0.16
Nodes (6): _absolutize_ids_in(), _id_anchor(), _portability_anchors(), _relativize_ids_in(), _rewrite_id_keyed_table_keys(), _rewrite_strings()

### Community 113 - "Community 113"
Cohesion: 0.19
Nodes (3): _distinct_node_labels(), push_to_falkordb(), push_to_neo4j()

### Community 114 - "Community 114"
Cohesion: 0.31
Nodes (12): extract_ocaml(), add_edge(), add_node(), emit_type(), _find_object_body(), last_name(), line_of(), named_child_text() (+4 more)

### Community 115 - "Community 115"
Cohesion: 0.16
Nodes (9): extract_corpus_parallel(), _checkpoint_chunk(), _out_of_scope(), _resolve_against_root(), _save_checkpoint(), _merge_into(), _partial_source_files(), _resolve_max_retry_depth() (+1 more)

### Community 116 - "Community 116"
Cohesion: 0.15
Nodes (6): classify_manifest_deletions(), classify_manifest_files(), detect_incremental(), _md5_file(), _mtime_may_hide_a_rewrite(), _stat_and_hash()

### Community 117 - "Community 117"
Cohesion: 0.22
Nodes (6): _html_document_title(), _html_script(), _html_styles(), _hyperedge_script(), to_html(), _viz_node_limit()

### Community 119 - "Community 119"
Cohesion: 0.22
Nodes (6): _build_id_label_maps(), build_learning_overlay(), reflect(), _render_bucket(), render_lessons_md(), write_learning_sidecar()

### Community 120 - "Community 120"
Cohesion: 0.17
Nodes (7): _in_new_graph(), _isolated_sourceless(), _coerce_hyperedge_member_refs(), _coerce_id(), _coerce_non_string_ids(), _hashable(), prefix_graph_for_global()

### Community 121 - "Community 121"
Cohesion: 0.17
Nodes (6): cache_dir(), _cleanup_stale_ast_entries(), _grammar_fingerprint(), mark_semantic_cache_partial(), prompt_fingerprint(), _resolve_prompt_fp()

### Community 122 - "Community 122"
Cohesion: 0.21
Nodes (6): _normalize_source_file_value(), scope_semantic_result(), _item_identity(), _semantic_source_matcher(), normalize_value(), source_identity()

### Community 123 - "Community 123"
Cohesion: 0.21
Nodes (8): _is_dotnet_source_file(), _metadata(), _resolve_csharp_type_references(), _canonical_stub_matches(), _dangling_stub_id(), _is_csharp_relevant_target(), _is_placeholder(), _label_for_type_ref_target()

### Community 125 - "Community 125"
Cohesion: 0.18
Nodes (6): _php_collect_type_refs(), _php_declared_type_name(), _php_first_declared_type(), _php_name_text(), _php_receiver_type_table(), _php_variable_text()

### Community 126 - "Community 126"
Cohesion: 0.23
Nodes (9): _python_module_instance_types(), _python_param_names(), _python_receiver_shadow_checker(), facts(), bind_names(), walk(), import_names(), is_shadowed() (+1 more)

### Community 127 - "Community 127"
Cohesion: 0.26
Nodes (7): extract_zig(), add_edge(), add_node(), _extract_import(), walk(), walk_calls(), _is_tagged_union()

### Community 128 - "Community 128"
Cohesion: 0.20
Nodes (6): _call_claude_cli(), _claude_cli_envelope(), _claude_cli_error(), _claude_cli_supports_json_schema(), _envelope_after_preamble(), _no_window_kwargs()

### Community 130 - "Community 130"
Cohesion: 0.22
Nodes (7): _backfill_origin(), _sweep_orphans(), _is_external_stub(), _reconcile_existing_graph(), _ast_owned(), _edge_evicted(), _reverse_leg_evicted()

### Community 131 - "Community 131"
Cohesion: 0.36
Nodes (10): extract_dm(), add_edge(), add_node(), _emit_call(), _ensure_type(), _find_child(), _read_include_path(), _type_path_text() (+2 more)

### Community 132 - "Community 132"
Cohesion: 0.22
Nodes (4): _atom(), _descendants(), extract_erlang(), resolve_erlang_remote_calls()

### Community 133 - "Community 133"
Cohesion: 0.18
Nodes (5): load_node_link_graph(), restore_arc_direction(), check_graph_file_size_cap(), _max_graph_file_bytes(), validate_graph_path()

### Community 134 - "Community 134"
Cohesion: 0.22
Nodes (5): _doc_twin_remap(), _has_independent_semantic_evidence(), _lost_saved_semantic_nodes(), _check_shrink(), _accounted()

### Community 135 - "Community 135"
Cohesion: 0.24
Nodes (5): _group_has_partial_marker(), save_semantic_cache(), group_skipped(), _recover_group_path(), resolved_source_path()

### Community 136 - "Community 136"
Cohesion: 0.20
Nodes (5): _generic_keyword_hit(), _is_env_template(), _is_graphable_source(), _is_prose_note(), _is_sensitive()

### Community 137 - "Community 137"
Cohesion: 0.20
Nodes (5): _has_build_output_markers(), _has_coverage_artifacts(), _has_msbuild_markers(), _has_venv_markers(), _is_noise_dir()

### Community 138 - "Community 138"
Cohesion: 0.20
Nodes (6): _eval(), _matches(), _lexical_relative(), _match_anchored_ignore_pattern(), _match_globstar_parts(), _parse_ignore_pattern()

### Community 139 - "Community 139"
Cohesion: 0.33
Nodes (8): _bind_member_field_tables(), _resolve_csharp_member_calls(), _call_return_type_nid(), _field_type_nid(), _key(), _method_on_type_or_bases(), _park_if_absent(), _resolve_type_name_nid()

### Community 140 - "Community 140"
Cohesion: 0.31
Nodes (8): _resolve_python_member_calls(), _emit_call(), _file_node(), _inherited_method(), _is_python_file(), _key(), _method_of(), _module_stem_key()

### Community 141 - "Community 141"
Cohesion: 0.20
Nodes (5): _scala_collect_context_bounds(), _scala_collect_type_refs(), _scala_extension_receiver_name(), _scala_extra_walk(), _scala_type_parameters_in_scope()

### Community 142 - "Community 142"
Cohesion: 0.31
Nodes (7): extract_json(), add_edge(), add_node(), _key_text(), _val_node(), walk_object(), _is_config_json()

### Community 143 - "Community 143"
Cohesion: 0.29
Nodes (7): extract_verilog(), add_edge(), add_node(), _scan_modules(), walk(), _sv_child(), _sv_first_identifier()

### Community 144 - "Community 144"
Cohesion: 0.20
Nodes (5): _balanced_object(), _json_fragment_candidates(), _json_object_candidates(), _parse_llm_json(), _sanitize_fragment()

### Community 145 - "Community 145"
Cohesion: 0.20
Nodes (5): load_learning_overlay(), load_memory_docs(), parse_memory_doc(), _yaml_unescape(), load_learning_for_report()

### Community 146 - "Community 146"
Cohesion: 0.16
Nodes (4): _sanitize_metadata_string(), _sanitize_metadata_value(), _SSRFGuardedHTTPHandler, _SSRFGuardedHTTPSHandler

### Community 147 - "Community 147"
Cohesion: 0.22
Nodes (3): _communities_from_graph(), _GraphContextCache, _load_graph()

### Community 148 - "Community 148"
Cohesion: 0.22
Nodes (5): _relativize_source_files_in(), _salted_key(), save_cached(), _extract_single_file(), _raise_recursion_limit()

### Community 150 - "Community 150"
Cohesion: 0.42
Nodes (7): _resolve_java_member_calls(), _chain_type(), _inherited_field_type(), _jvm_bases(), key(), _method_on_type_or_bases(), _type_named()

### Community 151 - "Community 151"
Cohesion: 0.22
Nodes (5): _decode_json_string_body(), _label_batch_with_retry(), _run_batch(), _parse_label_response(), _resolve_max_tokens()

### Community 152 - "Community 152"
Cohesion: 0.31
Nodes (4): _log_path(), log_query(), _log_responses(), nodes_from_result()

### Community 153 - "Community 153"
Cohesion: 0.25
Nodes (4): _absolutize_source_files_in(), check_semantic_cache(), load_cached(), _semantic_entry_matches_path()

### Community 154 - "Community 154"
Cohesion: 0.29
Nodes (4): endpoint_id(), first_present(), normalize_edge(), normalize_node()

### Community 155 - "Community 155"
Cohesion: 0.25
Nodes (4): generate_section_intro(), is_zh(), label_for_community(), section_keywords()

### Community 156 - "Community 156"
Cohesion: 0.25
Nodes (4): _entropy(), _is_label_char(), _norm(), _report_id_collision()

### Community 157 - "Community 157"
Cohesion: 0.36
Nodes (5): _csharp_keyword_type(), _resolve_csharp_extension_calls(), _key(), _resolve_type_nid(), _same_type()

### Community 158 - "Community 158"
Cohesion: 0.32
Nodes (5): _resolve_objc_member_calls(), _defines_selector(), _key(), _park_absent(), _resolve_member_target()

### Community 159 - "Community 159"
Cohesion: 0.25
Nodes (4): _swift_constructor_type(), _swift_factory_call(), _swift_local_var_types(), _swift_property_name()

### Community 160 - "Community 160"
Cohesion: 0.43
Nodes (6): _ruby_const_full_name(), _ruby_external_method_owners(), alias_rhs_refs(), constant_refs(), prefix_marker(), visit()

### Community 161 - "Community 161"
Cohesion: 0.32
Nodes (6): _php_fqn_from_raw(), _resolve_php_type_references(), _external_stub(), _record_raw(), _record_use_clause(), walk()

### Community 162 - "Community 162"
Cohesion: 0.25
Nodes (7): description, license, name, pi, extensions, private, type

### Community 164 - "Community 164"
Cohesion: 0.29
Nodes (4): os_long_path(), _graph_json_is_complete(), _stamp_build_state(), _write_build_state()

### Community 165 - "Community 165"
Cohesion: 0.29
Nodes (4): _has_chinese(), _is_searchable(), _query_terms(), _segment_chinese()

### Community 166 - "Community 166"
Cohesion: 0.33
Nodes (3): derive_flow_chain(), generate_overview_cards(), section_edge_summary()

### Community 167 - "Community 167"
Cohesion: 0.33
Nodes (3): html_anchor_id(), normalize_communities(), normalize_sections()

### Community 168 - "Community 168"
Cohesion: 0.33
Nodes (3): humanize_label(), node_display_name(), truncate_text()

### Community 169 - "Community 169"
Cohesion: 0.33
Nodes (3): _resolve_csharp_constructor_calls(), _pick(), _csharp_pick_overload()

### Community 170 - "Community 170"
Cohesion: 0.33
Nodes (3): _swift_collect_type_refs(), _swift_extra_walk(), _swift_type_parameters_in_scope()

### Community 171 - "Community 171"
Cohesion: 0.33
Nodes (3): _java_import_rows(), walk(), _resolve_cross_file_java_imports()

### Community 172 - "Community 172"
Cohesion: 0.33
Nodes (3): _bedrock_inference_config(), _model_requires_default_temperature(), _resolve_temperature()

### Community 173 - "Community 173"
Cohesion: 0.33
Nodes (3): _build_opener(), safe_fetch(), safe_fetch_text()

### Community 176 - "Community 176"
Cohesion: 0.53
Nodes (5): _reconcile_markdown_links(), _is_code_file_citation(), _is_code_span_mention(), _keep_edge(), _matches_unresolved_target()

### Community 177 - "Community 177"
Cohesion: 0.40
Nodes (3): _content_richness(), _pick_winner(), _score()

### Community 178 - "Community 178"
Cohesion: 0.40
Nodes (3): _is_reference_stub(), _namespace_reference_stub_collisions(), key()

### Community 181 - "Community 181"
Cohesion: 0.40
Nodes (3): _ruby_local_class_bindings(), visit(), _ruby_new_class_name()

### Community 182 - "Community 182"
Cohesion: 0.40
Nodes (3): _opencode_config_names_plugin(), _opencode_plugin_is_v1_only(), pending()

### Community 184 - "Community 184"
Cohesion: 0.40
Nodes (3): _add(), _provenance_for(), _resolve_canonical_id()

## Knowledge Gaps
- **1 isolated node(s):** `RFC-8089`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 1798 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `_read_text()` connect `Community 13` to `Community 0`, `Community 1`, `Community 131`, `Community 132`, `Community 6`, `Community 8`, `Community 9`, `Community 11`, `Community 12`, `Community 141`, `Community 142`, `Community 15`, `Community 143`, `Community 19`, `Community 24`, `Community 26`, `Community 159`, `Community 32`, `Community 160`, `Community 34`, `Community 161`, `Community 40`, `Community 170`, `Community 171`, `Community 181`, `Community 53`, `Community 58`, `Community 59`, `Community 188`, `Community 60`, `Community 65`, `Community 69`, `Community 71`, `Community 84`, `Community 93`, `Community 106`, `Community 114`, `Community 125`, `Community 126`, `Community 127`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Are the 269 inferred relationships involving `_read_text()` (e.g. with `_get_c_func_name()` and `_import_c()`) actually correct?**
  _`_read_text()` has 269 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-8089` to the rest of the system?**
  _1 weakly-connected nodes found - possible missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.0350526456084233 - nodes in this community are weakly interconnected._
- **Why does `_make_id()` connect `Community 24` to `Community 0`, `Community 1`, `Community 131`, `Community 132`, `Community 5`, `Community 6`, `Community 8`, `Community 9`, `Community 11`, `Community 12`, `Community 141`, `Community 142`, `Community 15`, `Community 14`, `Community 143`, `Community 26`, `Community 30`, `Community 32`, `Community 33`, `Community 34`, `Community 161`, `Community 163`, `Community 40`, `Community 170`, `Community 171`, `Community 46`, `Community 48`, `Community 53`, `Community 59`, `Community 60`, `Community 61`, `Community 68`, `Community 69`, `Community 71`, `Community 73`, `Community 83`, `Community 84`, `Community 93`, `Community 107`, `Community 108`, `Community 114`, `Community 123`, `Community 124`, `Community 127`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Are the 156 inferred relationships involving `_make_id()` (e.g. with `extract_apex()` and `make_id()`) actually correct?**
  _`_make_id()` has 156 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.02997707635337683 - nodes in this community are weakly interconnected._