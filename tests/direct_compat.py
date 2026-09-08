"""genlayer-test 0.29.2 Windows stdin and cross-platform warp compatibility.

Infrastructure shim only: no review output, gate result, or storage is mocked here.
"""
import os
import sys
import tempfile


def install():
    from gltest.direct import loader
    from gltest.direct.vm import VMContext
    if getattr(loader, "_translatecheck_compat", False):
        return
    if sys.platform == "win32":
        def inject(vm):
            from genlayer.py import calldata
            from genlayer.py.types import Address
            address = lambda x: Address(x) if isinstance(x, bytes) else x
            encoded = calldata.encode({"contract_address": address(vm._contract_address),
                "sender_address": address(vm.sender), "origin_address": address(vm.origin),
                "stack": [], "value": vm._value, "datetime": vm._datetime,
                "is_init": False, "chain_id": vm._chain_id, "entry_kind": 0,
                "entry_data": b"", "entry_stage_data": None})
            fd, path = tempfile.mkstemp()
            try:
                os.write(fd, encoded)
                os.lseek(fd, 0, os.SEEK_SET)
                vm._original_stdin_fd = os.dup(0)
                os.dup2(fd, 0)
                vm._translatecheck_stdin_path = path
            finally:
                os.close(fd)
        original_cleanup = VMContext._cleanup_after_deactivate
        def cleanup(vm):
            path = getattr(vm, "_translatecheck_stdin_path", None)
            try:
                original_cleanup(vm)
            finally:
                if path:
                    try:
                        os.unlink(path)
                    except FileNotFoundError:
                        pass
                    vm._translatecheck_stdin_path = None
        loader._inject_message_to_fd0 = inject
        VMContext._cleanup_after_deactivate = cleanup
    refresh_original = VMContext._refresh_gl_message
    def refresh(vm):
        refresh_original(vm)
        module = sys.modules.get("genlayer.gl")
        if module is not None and getattr(module, "message_raw", None) is not None:
            module.message_raw["datetime"] = vm._datetime
    VMContext._refresh_gl_message = refresh
    loader._translatecheck_compat = True
